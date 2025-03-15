use crate::control::start_control_process;
use crate::jobject::create_jobject_string;
use crate::scopes::ScopeStorage;
use crate::stdio::RedirectedStdio;
use comm::messages::{
    CodeLeaf, CodeNode, CodeScope, ComputeMsg, Exception, KernelOutputValue, OutputFlag,
};
use pyo3::types::{PyAnyMethods, PyDict, PyTracebackMethods};
use pyo3::types::{PyNone, PyStringMethods};
use pyo3::{Bound, IntoPyObjectExt, PyAny, PyErr, PyResult, Python};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::runtime::Builder;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

pub type Globals = HashMap<String, Arc<String>>;

#[derive(Debug)]
pub enum FromExecutorMessage {
    Output {
        value: KernelOutputValue,
        cell_id: Uuid,
        flag: OutputFlag,
        globals: Option<Globals>,
    },
}

pub fn start_executor() {
    let (o_sender, c_receiver) = start_control_process();
    Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            if let Err(e) = executor_main(o_sender, c_receiver).await {
                panic!("Error: {:?}", e);
            }
        });
}

fn try_repr_html(obj: &Bound<PyAny>) -> PyResult<Option<String>> {
    if let Ok(repr_html) = obj.getattr("_repr_html_") {
        let html_repr = repr_html.call0()?;
        let str: String = html_repr.extract()?;
        Ok(Some(str))
    } else {
        Ok(None)
    }
}

fn eval_code<'a>(
    py: Python<'a>,
    code: &str,
    globals: &Bound<'a, PyDict>,
    locals: &Bound<'a, PyDict>,
    stdout: &'a Bound<PyAny>,
    return_last: bool,
) -> PyResult<Bound<'a, PyAny>> {
    let run_module = py.import("twinsong.driver.run")?;
    run_module
        .getattr("run_code")?
        .call1((code, globals, locals, stdout, return_last))
}

struct CodeEnv<'a> {
    leaf: &'a CodeLeaf,
    globals: Bound<'a, PyDict>,
    locals: Bound<'a, PyDict>,
}

fn collect_code_leafs<'a, 'b>(
    node: &'a CodeNode,
    py: Python<'a>,
    scope_storage: &'b mut ScopeStorage,
    parent_scopes: &'b mut Vec<Uuid>,
    out: &mut Vec<CodeEnv<'a>>,
) {
    match node {
        CodeNode::Group(group) => {
            match group.scope {
                CodeScope::Scope(id) => {
                    parent_scopes.push(id);
                }
                CodeScope::Inherit => {}
            }
            for child in &group.children {
                collect_code_leafs(child, py, scope_storage, parent_scopes, out);
            }
            match group.scope {
                CodeScope::Scope(_) => {
                    parent_scopes.pop();
                }
                CodeScope::Inherit => {}
            }
        }
        CodeNode::Leaf(leaf) => {
            let (globals, locals) = scope_storage
                .make_globals_and_locals(py, &parent_scopes)
                .unwrap();
            out.push(CodeEnv {
                leaf,
                globals,
                locals,
            })
        }
    }
}

fn run_code(
    py: Python,
    scope_storage: &mut ScopeStorage,
    parent_scopes: &mut Vec<Uuid>,
    code: &CodeNode,
    stdout: Bound<PyAny>,
) -> PyResult<KernelOutputValue> {
    // let s = CString::new(code.as_bytes())?;
    // let result = py.eval(&s, None, None)?;
    let mut codes = Vec::new();
    collect_code_leafs(code, py, scope_storage, parent_scopes, &mut codes);
    if codes.is_empty() {
        return Ok(KernelOutputValue::None);
    }
    let last = codes.pop().unwrap();
    for code in codes {
        eval_code(
            py,
            &code.leaf.code,
            &code.globals,
            &code.locals,
            &stdout,
            false,
        )?;
    }
    let result = eval_code(
        py,
        &last.leaf.code,
        &last.globals,
        &last.locals,
        &stdout,
        true,
    )?;
    if result.is_none() {
        return Ok(KernelOutputValue::None);
    }
    Ok(if let Some(value) = try_repr_html(&result)? {
        KernelOutputValue::Html { value }
    } else {
        let repr = result.repr()?;
        let repr = repr.to_str()?;
        KernelOutputValue::Text {
            value: repr.to_owned(),
        }
    })
}

fn create_traceback(py: &Python, e: PyErr) -> PyResult<Exception> {
    let traceback = e
        .traceback(*py)
        .and_then(|t| t.format().ok())
        .unwrap_or_default();

    Ok(Exception {
        message: e.to_string(),
        traceback,
    })
}

fn get_globals(py: Python) -> Globals {
    let run_module = py.import("twinsong.driver.run").unwrap();
    let variables: HashMap<String, Bound<'_, PyAny>> =
        run_module.getattr("VARIABLES").unwrap().extract().unwrap();
    variables
        .into_iter()
        .filter_map(|(k, v)| {
            if k != "__builtins__" {
                Some((k, Arc::new(create_jobject_string(py, &v).unwrap())))
            } else {
                None
            }
        })
        .collect()
}

async fn executor_main(
    o_sender: UnboundedSender<FromExecutorMessage>,
    mut c_receiver: UnboundedReceiver<ComputeMsg>,
) -> anyhow::Result<()> {
    let mut parent_scopes = Vec::new();
    let mut scope_storage = ScopeStorage::default();
    while let Some(msg) = c_receiver.recv().await {
        tracing::debug!("New command: {:?}", msg);
        let stdout = RedirectedStdio::new(o_sender.clone(), msg.cell_id);
        let out_msg = Python::with_gil(|py| {
            let stdout = stdout.into_bound_py_any(py).unwrap();
            match run_code(
                py,
                &mut scope_storage,
                &mut parent_scopes,
                &msg.code,
                stdout,
            ) {
                Ok(output) => FromExecutorMessage::Output {
                    value: output,
                    cell_id: msg.cell_id,
                    flag: OutputFlag::Success,
                    globals: Some(get_globals(py)),
                },
                Err(e) => FromExecutorMessage::Output {
                    value: KernelOutputValue::Exception {
                        value: create_traceback(&py, e).unwrap(),
                    },
                    cell_id: msg.cell_id,
                    flag: OutputFlag::Fail,
                    globals: Some(get_globals(py)),
                },
            }
        });
        tracing::debug!("Send output: {:?}", out_msg);
        o_sender.send(out_msg).unwrap();
    }
    Ok(())
}
