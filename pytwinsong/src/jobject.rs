use pyo3::types::{
    PyAnyMethods, PyBool, PyFloat, PyInt, PyList, PyListMethods, PyString, PyStringMethods,
    PyTypeMethods,
};
use pyo3::{Bound, PyAny, PyErr, PyObject, PyResult, Python};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};

use serde::Serialize;

pub type JsonObjectId = u64;

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub struct JsonObject<'a> {
    pub values: Vec<JsonObjectValue<'a>>,
    pub root: JsonObjectId,
}

// Helper function to check if a Cow<str> is empty
fn is_empty_cow_str(s: &Cow<'_, str>) -> bool {
    s.is_empty()
}

#[derive(Debug, Serialize)]
pub struct JsonObjectValue<'a> {
    pub id: JsonObjectId,
    pub slot: Cow<'a, str>,
    pub repr: Cow<'a, str>,

    pub value_type: Cow<'a, str>,

    #[serde(skip_serializing_if = "str::is_empty")]
    pub kind: &'static str,

    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<JsonObjectId>,
}

#[derive(Debug)]
enum TypeCollection<'a> {
    Unknown,
    Unique(Cow<'a, str>),
    Many,
}

impl<'a> TypeCollection<'a> {
    pub fn add(&mut self, name: &'a Cow<'a, str>) {
        match self {
            TypeCollection::Unknown => *self = TypeCollection::Unique(name.clone()),
            TypeCollection::Unique(t) if t.as_ref() == name.as_ref() => { /* Do nothing */ }
            TypeCollection::Unique(_) => *self = TypeCollection::Many,
            TypeCollection::Many => { /* Do nothing */ }
        }
    }

    pub fn create_name<'b>(&self, name: &'b str) -> Cow<'b, str> {
        match self {
            TypeCollection::Unknown | TypeCollection::Many => name.into(),
            TypeCollection::Unique(t) => format!("{name}[{}]", t.as_ref()).into(),
        }
    }

    pub fn is_many(&self) -> bool {
        matches!(self, TypeCollection::Many)
    }
}

pub fn create_jobject_string(
    py: Python,
    slot: Cow<str>,
    obj: &Bound<PyAny>,
) -> serde_json::Result<String> {
    serde_json::to_string(&create_jobject(py, slot, obj))
}

pub fn create_jobject<'a>(py: Python, slot: Cow<'a, str>, obj: &Bound<PyAny>) -> JsonObject<'a> {
    let mut values = HashMap::new();
    let root = create_jobject_helper(py, slot, obj, &mut values);

    JsonObject {
        values: values.into_values().collect(),
        root,
    }
}

fn simple_value<'a>(
    slot: Cow<'a, str>,
    repr: Cow<'a, str>,
    value_type: Cow<'a, str>,
    kind: &'static str,
) -> JsonObjectValue<'a> {
    JsonObjectValue {
        id: 0,
        slot,
        repr,
        value_type,
        kind,
        children: Vec::new(),
    }
}

fn string_value(obj: PyResult<Bound<PyString>>) -> String {
    obj.as_ref()
        .map(|o| o.to_string_lossy().to_string().into())
        .unwrap_or_default()
}

fn create_jobject_helper<'a>(
    py: Python,
    slot: Cow<'a, str>,
    obj: &Bound<PyAny>,
    values: &mut HashMap<JsonObjectId, JsonObjectValue<'a>>,
) -> JsonObjectId {
    let id = obj.as_ptr() as u64;
    if values.contains_key(&id) {
        return id;
    }
    let mut value = if obj.is_none() {
        simple_value(slot, "None".into(), "".into(), "null")
    } else if let Ok(obj) = obj.downcast_exact::<PyInt>() {
        simple_value(slot, obj.to_string().into(), "int".into(), "number")
    } else if let Ok(obj) = obj.downcast_exact::<PyFloat>() {
        simple_value(slot, obj.to_string().into(), "float".into(), "number")
    } else if let Ok(obj) = obj.downcast_exact::<PyString>() {
        simple_value(
            slot,
            format!("\"{}\"", PyStringMethods::to_str(obj).unwrap_or_default()).into(),
            "str".into(),
            "string",
        )
    } else if let Ok(obj) = obj.downcast_exact::<PyList>() {
        let children: Vec<_> = obj
            .into_iter()
            .enumerate()
            .map(|(idx, child)| create_jobject_helper(py, idx.to_string().into(), &child, values))
            .collect();
        let mut tc = TypeCollection::Unknown;
        for id in &children {
            tc.add(&values.get(id).unwrap().value_type);
            if tc.is_many() {
                break;
            }
        }
        let mut repr = "[".to_string();
        for (idx, id) in children.iter().enumerate() {
            let child = &values.get(id).unwrap();
            if repr.len() + child.repr.len() > 24 {
                repr.clear();
                break;
            }
            if idx > 0 {
                repr.push_str(", ");
            }
            repr.push_str(&child.repr);
        }
        if repr.is_empty() {
            repr = format!("[{} elements]", PyListMethods::len(obj));
        } else {
            repr.push(']');
        }
        JsonObjectValue {
            id,
            slot,
            repr: repr.into(),
            value_type: tc.create_name("list"),
            kind: "",
            children,
        }
    } else {
        let value_type = string_value(obj.get_type().qualname());
        let repr = string_value(obj.repr());
        simple_value(slot, repr.into(), value_type.into(), "")
    };
    value.id = id;
    values.insert(id, value);
    id
}
