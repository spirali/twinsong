mod control;
mod executor;
mod jobject;
mod scopes;
mod stdio;

use crate::executor::start_executor;
use crate::jobject::create_jobject_string;
use pyo3::intern;
use pyo3::prelude::*;
use std::ffi::OsString;
use std::path::Path;
use tokio::runtime::Builder;

#[pyfunction]
fn start_kernel() -> PyResult<()> {
    start_executor();
    Ok(())
}

fn get_argv(py: Python) -> PyResult<Vec<String>> {
    py.import(intern!(py, "sys"))?
        .getattr(intern!(py, "argv"))?
        .extract()
}

fn get_executable(py: Python) -> PyResult<OsString> {
    py.import(intern!(py, "sys"))?
        .getattr(intern!(py, "executable"))?
        .extract()
}

#[pyfunction]
fn start_server() -> PyResult<()> {
    if std::env::var("TWINSONG_PYTHON").is_err() {
        Python::with_gil(|py| {
            if let Ok(value) = get_executable(py) {
                unsafe {
                    /* SAFETY
                       This function is called at the beginning before the whole server is started,
                        moreover, we are holding GIL.
                    */
                    std::env::set_var("TWINSONG_PYTHON", value);
                }
            }
        });
    }
    let args: Vec<String> = Python::with_gil(get_argv)?;
    Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            ::twinsong::server_cli(Some(args)).await;
        });
    Ok(())
}

#[pyfunction]
fn create_jobject(py: Python, obj: Bound<PyAny>) -> PyResult<String> {
    Ok(create_jobject_string(py, &obj).unwrap())
}

/// A Python module implemented in Rust.
#[pymodule]
fn twinsong(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(start_kernel, m)?)?;
    m.add_function(wrap_pyfunction!(start_server, m)?)?;
    m.add_function(wrap_pyfunction!(create_jobject, m)?)?;
    Ok(())
}
