use pyo3::types::{PyDict, PyDictMethods};
use pyo3::{Bound, BoundObject, Py, PyResult, Python};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Default)]
pub(crate) struct ScopeStorage {
    scopes: HashMap<Vec<Uuid>, Py<PyDict>>,
}

impl ScopeStorage {
    pub fn make_globals_and_locals<'a>(
        &mut self,
        py: Python<'a>,
        scope_path: &[Uuid],
    ) -> PyResult<(Bound<'a, PyDict>, Bound<'a, PyDict>)> {
        let globals = PyDict::new(py);
        if !self.scopes.is_empty() {
            for i in 0..self.scopes.len() - 1 {
                if let Some(scope) = self.scopes.get(&scope_path[..i]) {
                    globals.update(&scope.bind_borrowed(py).as_mapping())?;
                }
            }
        }
        let locals = if let Some(scope) = self.scopes.get(scope_path) {
            scope.bind_borrowed(py).to_owned()
        } else {
            let dict = PyDict::new(py);
            self.scopes
                .insert(scope_path.to_vec(), dict.clone().unbind());
            dict
        };
        Ok((globals, locals))
    }
}
