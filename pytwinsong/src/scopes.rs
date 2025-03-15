use crate::executor::SerializedScopes;
use crate::jobject::create_jobject_string;
use comm::messages::ScopeKey;
use pyo3::types::{PyDict, PyDictMethods};
use pyo3::{Bound, BoundObject, Py, PyResult, Python};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

pub type SerializedScope = HashMap<String, Arc<String>>;
pub type SerializedScopes = HashMap<Vec<Uuid>, SerializedScope>;

#[derive(Debug, Default)]
pub(crate) struct ScopePyStorage {
    scopes: HashMap<ScopeKey, Py<PyDict>>,
}

impl ScopePyStorage {
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

    pub fn gather_objects(&self, py: Python) -> SerializedScopes {
        self.scopes
            .iter()
            .map(|(k, v)| {
                (
                    k.clone(),
                    v.iter()
                        .map(|name, obj| {
                            (
                                name.clone(),
                                Arc::new(create_jobject_string(py, &v).unwrap()),
                            )
                        })
                        .collect(),
                )
            })
            .collect()
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
    }
}
