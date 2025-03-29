use crate::control::start_control_process;
use crate::scopes::ScopedPyGlobals;
use crate::stdio::RedirectedStdio;
use comm::messages::{
    CodeGroup, CodeLeaf, CodeNode, CodeScope, ComputeMsg, Exception, KernelOutputValue, OutputFlag,
    OwnCodeScope,
};
use comm::scopes::SerializedGlobals;
use pyo3::types::{PyAnyMethods, PyDict, PyTracebackMethods};
use pyo3::types::{PyNone, PyStringMethods};
use pyo3::{Bound, IntoPyObjectExt, PyAny, PyErr, PyResult, Python};
use tokio::runtime::Builder;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

#[derive(Debug)]
pub enum FromExecutorMessage {
    Output {
        value: KernelOutputValue,
        cell_id: Uuid,
        flag: OutputFlag,
        update: Option<SerializedGlobals>,
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
    parent: Option<&Bound<'a, PyDict>>,
    locals: &Bound<'a, PyDict>,
    stdout: &'a Bound<PyAny>,
    return_last: bool,
) -> PyResult<Bound<'a, PyAny>> {
    let run_module = py.import("twinsong.driver.run")?;
    let parent = parent
        .map(|x| x.clone().into_any())
        .unwrap_or_else(|| PyNone::get(py).to_owned().into_any());
    run_module
        .getattr("run_code")?
        .call1((code, globals, parent, locals, stdout, return_last))
}

struct CodeEnv<'a> {
    leaf: &'a CodeLeaf,
    globals: Bound<'a, PyDict>,
    parent: Option<Bound<'a, PyDict>>,
    locals: Bound<'a, PyDict>,
}

fn collect_code_leafs<'a, 'b>(
    group: &'a CodeGroup,
    py: Python<'a>,
    scope_storage: &'b mut ScopedPyGlobals,
    parent_scopes: &'b mut Vec<&'a OwnCodeScope>,
    out: &mut Vec<CodeEnv<'a>>,
) {
    for child in &group.children {
        match child {
            CodeNode::Group(group) => {
                match &group.scope {
                    CodeScope::Own(own_scope) => {
                        parent_scopes.push(own_scope);
                    }
                    CodeScope::Inherit => {}
                }
                collect_code_leafs(group, py, scope_storage, parent_scopes, out);
                match group.scope {
                    CodeScope::Own(_) => {
                        parent_scopes.pop();
                    }
                    CodeScope::Inherit => {}
                }
            }
            CodeNode::Leaf(leaf) => {
                let (globals, parent, locals) = scope_storage
                    .make_globals_parent_and_locals(py, parent_scopes)
                    .unwrap();
                out.push(CodeEnv {
                    leaf,
                    globals,
                    parent,
                    locals,
                })
            }
        }
    }
}

fn run_code(
    py: Python<'_>,
    py_scopes: &mut ScopedPyGlobals,
    code: &CodeGroup,
    stdout: Bound<PyAny>,
) -> PyResult<KernelOutputValue> {
    // let s = CString::new(code.as_bytes())?;
    // let result = py.eval(&s, None, None)?;
    let mut codes = Vec::new();
    let mut parent_scopes = Vec::new();
    collect_code_leafs(code, py, py_scopes, &mut parent_scopes, &mut codes);
    if codes.is_empty() {
        return Ok(KernelOutputValue::None);
    }
    let last = codes.pop().unwrap();
    for code in codes {
        eval_code(
            py,
            &code.leaf.code,
            &code.globals,
            code.parent.as_ref(),
            &code.locals,
            &stdout,
            false,
        )?;
    }
    let result = eval_code(
        py,
        &last.leaf.code,
        &last.globals,
        last.parent.as_ref(),
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

/*fn get_globals(py: Python, scope_storage: &ScopeStorage) -> ScopeObjects {
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
}*/

async fn executor_main(
    o_sender: UnboundedSender<FromExecutorMessage>,
    mut c_receiver: UnboundedReceiver<ComputeMsg>,
) -> anyhow::Result<()> {
    let mut py_scopes = Python::with_gil(ScopedPyGlobals::new);
    while let Some(msg) = c_receiver.recv().await {
        tracing::debug!("New command: {:?}", msg);
        let stdout = RedirectedStdio::new(o_sender.clone(), msg.cell_id);
        let out_msg = Python::with_gil(|py| {
            let stdout = stdout.into_bound_py_any(py).unwrap();
            match run_code(py, &mut py_scopes, &msg.code, stdout) {
                Ok(output) => FromExecutorMessage::Output {
                    value: output,
                    cell_id: msg.cell_id,
                    flag: OutputFlag::Success,
                    update: Some(py_scopes.serialize(py)),
                },
                Err(e) => FromExecutorMessage::Output {
                    value: KernelOutputValue::Exception {
                        value: create_traceback(&py, e).unwrap(),
                    },
                    cell_id: msg.cell_id,
                    flag: OutputFlag::Fail,
                    update: Some(py_scopes.serialize(py)),
                },
            }
        });
        tracing::debug!("Send output: {:?}", out_msg);
        o_sender.send(out_msg).unwrap();
    }
    Ok(())
}
