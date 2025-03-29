use crate::jobject::create_jobject_string;
use comm::messages::OwnCodeScope;
use comm::scopes::{ScopeId, SerializedGlobals};
use pyo3::types::{PyDict, PyDictMethods};
use pyo3::{Bound, Py, PyResult, Python};
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug)]
pub(crate) struct ScopedPyGlobals {
    name: String,
    variables: Py<PyDict>,
    children: HashMap<ScopeId, ScopedPyGlobals>,
}

impl ScopedPyGlobals {
    pub fn new(py: Python) -> Self {
        ScopedPyGlobals {
            name: String::new(),
            variables: PyDict::new(py).unbind(),
            children: HashMap::new(),
        }
    }

    pub fn update_name(&mut self, name: &str) {
        if self.name.as_str() != name {
            self.name = name.to_string();
        }
    }

    #[allow(clippy::type_complexity)]
    pub fn make_globals_parent_and_locals<'a>(
        &mut self,
        py: Python<'a>,
        scope_path: &[&OwnCodeScope],
    ) -> PyResult<(
        Bound<'a, PyDict>,
        Option<Bound<'a, PyDict>>,
        Bound<'a, PyDict>,
    )> {
        if scope_path.is_empty() {
            let globals = PyDict::new(py);
            let locals = self.variables.bind_borrowed(py).to_owned();
            Ok((globals.clone(), None, locals))
        } else {
            let scope = &scope_path[0];
            let entry = self
                .children
                .entry(scope.id)
                .or_insert_with(|| ScopedPyGlobals::new(py));
            entry.update_name(&scope.name);
            let (globals, mut parent, locals) =
                entry.make_globals_parent_and_locals(py, &scope_path[1..])?;
            let variables = self.variables.bind_borrowed(py);
            globals.update(variables.as_mapping())?;
            if parent.is_none() {
                parent = Some(variables.to_owned());
            }
            Ok((globals, parent, locals))
        }
    }

    pub fn serialize(&mut self, py: Python) -> SerializedGlobals {
        let variables = self
            .variables
            .bind_borrowed(py)
            .iter()
            .map(|(k, v)| {
                (
                    k.to_string(),
                    Arc::new(create_jobject_string(py, &v).unwrap()),
                )
            })
            .collect();
        let children = self
            .children
            .iter_mut()
            .map(|(k, v)| (*k, v.serialize(py)))
            .collect();
        SerializedGlobals::new(self.name.clone(), variables, children)
    }
}
