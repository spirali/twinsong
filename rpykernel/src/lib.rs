mod control;
mod executor;
mod stdio;

use crate::executor::start_executor;
use pyo3::prelude::*;

#[pyfunction]
fn start_rpykernel() -> PyResult<()> {
    start_executor();
    Ok(())
}

/// A Python module implemented in Rust.
#[pymodule]
fn rpykernel(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(start_rpykernel, m)?)?;
    Ok(())
}
