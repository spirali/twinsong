mod control;
mod executor;
mod stdio;

use crate::executor::start_executor;
use pyo3::prelude::*;
use tokio::runtime::Builder;

#[pyfunction]
fn start_kernel() -> PyResult<()> {
    start_executor();
    Ok(())
}

fn get_argv(py: Python) -> PyResult<Vec<String>> {
    py.import("sys")?.getattr("argv")?.extract()
}

#[pyfunction]
fn start_server() -> PyResult<()> {
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

/// A Python module implemented in Rust.
#[pymodule]
fn twinsong(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(start_kernel, m)?)?;
    m.add_function(wrap_pyfunction!(start_server, m)?)?;
    Ok(())
}
