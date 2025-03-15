use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

pub type ScopeId = Uuid;

#[derive(Debug, Deserialize, Serialize)]
pub struct SerializedGlobalsUpdate {
    name: String,
    variables: HashMap<String, Option<Arc<String>>>,
    children: HashMap<ScopeId, SerializedGlobalsUpdate>,
}

impl SerializedGlobalsUpdate {
    pub fn apply(self, mut globals: Option<&mut SerializedGlobals>) -> SerializedGlobals {
        let variables = self
            .variables
            .into_iter()
            .map(|(k, v)| {
                let new_value =
                    v.unwrap_or_else(|| globals.as_mut().unwrap().variables.remove(&k).unwrap());
                (k, new_value)
            })
            .collect();
        let children = self
            .children
            .into_iter()
            .map(|(k, v)| {
                (
                    k,
                    v.apply(globals.as_mut().and_then(|g| g.children.get_mut(&k))),
                )
            })
            .collect();
        SerializedGlobals {
            name: self.name,
            variables,
            children,
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct SerializedGlobals {
    name: String,
    variables: HashMap<String, Arc<String>>,
    children: HashMap<ScopeId, SerializedGlobals>,
}

impl SerializedGlobals {
    pub fn new(
        name: String,
        variables: HashMap<String, Arc<String>>,
        children: HashMap<ScopeId, SerializedGlobals>,
    ) -> Self {
        SerializedGlobals {
            name,
            variables,
            children,
        }
    }

    pub fn create_update(
        &self,
        old_globals: Option<&SerializedGlobals>,
    ) -> SerializedGlobalsUpdate {
        let variables = self
            .variables
            .iter()
            .map(|(name, value)| {
                (
                    name.clone(),
                    if let Some(true) = old_globals
                        .and_then(|g| g.variables.get(name).map(|v| v.as_str() == value.as_str()))
                    {
                        None
                    } else {
                        Some(value.clone())
                    },
                )
            })
            .collect();
        let children = self
            .children
            .iter()
            .map(|(key, value)| {
                let values = value.create_update(old_globals.and_then(|g| g.children.get(key)));
                (*key, values)
            })
            .collect();
        SerializedGlobalsUpdate {
            name: self.name.clone(),
            variables,
            children,
        }
    }
}
