use crate::control::start_control_process;
use crate::stdio::RedirectedStdio;
use comm::messages::{ComputeMsg, Exception, FromKernelMessage, KernelOutputValue, OutputFlag};
use pyo3::types::PyStringMethods;
use pyo3::types::{PyAnyMethods, PyTracebackMethods};
use pyo3::{Bound, PyAny, PyErr, PyResult, Python};
use tokio::runtime::Builder;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};

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
    stdout: RedirectedStdio,
) -> PyResult<Bound<'a, PyAny>> {
    let run_module = py.import("twinsong.driver.run")?;
    run_module.getattr("run_code")?.call1((code, stdout))
}

fn run_code(py: &Python, code: &str, stdout: RedirectedStdio) -> PyResult<KernelOutputValue> {
    // let s = CString::new(code.as_bytes())?;
    // let result = py.eval(&s, None, None)?;
    let result = eval_code(*py, code, stdout)?;
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

async fn executor_main(
    o_sender: UnboundedSender<FromKernelMessage>,
    mut c_receiver: UnboundedReceiver<ComputeMsg>,
) -> anyhow::Result<()> {
    while let Some(msg) = c_receiver.recv().await {
        tracing::debug!("New command: {:?}", msg);
        let stdout = RedirectedStdio::new(o_sender.clone(), msg.cell_id);

        let out_msg = Python::with_gil(|py| match run_code(&py, &msg.code, stdout) {
            Ok(output) => FromKernelMessage::Output {
                value: output,
                cell_id: msg.cell_id,
                flag: OutputFlag::Success,
            },
            Err(e) => FromKernelMessage::Output {
                value: KernelOutputValue::Exception {
                    value: create_traceback(&py, e).unwrap(),
                },
                cell_id: msg.cell_id,
                flag: OutputFlag::Fail,
            },
        });
        tracing::debug!("Send output: {:?}", out_msg);
        o_sender.send(out_msg).unwrap();
    }
    Ok(())
}
