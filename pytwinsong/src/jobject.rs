use pyo3::types::{
    PyAnyMethods, PyBool, PyDict, PyDictMethods, PyFloat, PyInt, PyList, PyListMethods, PyModule,
    PyModuleMethods, PyString, PyStringMethods, PyType, PyTypeMethods,
};
use pyo3::{Bound, PyAny, PyClass, PyErr, PyObject, PyResult, Python};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};

use serde::Serialize;

pub type JsonObjectId = u64;

#[derive(Debug, Serialize)]
pub struct JsonObjectDump<'a> {
    pub objects: Vec<JsonObject<'a>>,
    pub root: JsonObjectId,
}

// Helper function to check if a Cow<str> is empty
fn is_empty_cow_str(s: &Cow<'_, str>) -> bool {
    s.is_empty()
}

#[derive(Debug, Serialize)]
pub struct JsonObject<'a> {
    pub id: JsonObjectId,
    pub repr: Cow<'a, str>,

    #[serde(skip_serializing_if = "is_empty_cow_str")]
    pub value_type: Cow<'a, str>,

    #[serde(skip_serializing_if = "str::is_empty")]
    pub kind: &'static str,

    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<(Cow<'a, str>, JsonObjectId)>,
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

pub fn create_jobject_string(py: Python, obj: &Bound<PyAny>) -> serde_json::Result<String> {
    serde_json::to_string(&create_jobject_dump(py, obj))
}

pub fn create_jobject_dump<'a>(py: Python, obj: &Bound<PyAny>) -> JsonObjectDump<'a> {
    let mut values = HashMap::new();
    let root = create_jobject_helper(&py, obj, &mut values);

    JsonObjectDump {
        objects: values.into_values().collect(),
        root,
    }
}

fn simple_value<'a>(
    repr: Cow<'a, str>,
    value_type: Cow<'a, str>,
    kind: &'static str,
) -> JsonObject<'a> {
    JsonObject {
        id: 0,
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

fn find_collection_element_type<'a>(
    it: impl Iterator<Item = &'a Cow<'a, str>>,
) -> TypeCollection<'a> {
    let mut tc = TypeCollection::Unknown;
    for name in it {
        tc.add(name);
        if tc.is_many() {
            break;
        }
    }
    tc
}

fn create_list<'a>(
    py: &Python,
    obj: &Bound<PyList>,
    values: &mut HashMap<JsonObjectId, JsonObject<'a>>,
) -> JsonObject<'a> {
    let children: Vec<_> = obj
        .into_iter()
        .enumerate()
        .map(|(idx, child)| {
            (
                idx.to_string().into(),
                create_jobject_helper(py, &child, values),
            )
        })
        .collect();
    let tc = find_collection_element_type(
        children
            .iter()
            .map(|(_, id)| &values.get(id).unwrap().value_type),
    );
    let mut repr = "[".to_string();
    for (idx, (_, id)) in children.iter().enumerate() {
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
        repr = format!("{} items", PyListMethods::len(obj));
    } else {
        repr.push(']');
    }
    JsonObject {
        id: 0,
        repr: repr.into(),
        value_type: tc.create_name("list"),
        kind: "list",
        children,
    }
}

fn create_module<'a>(
    py: &Python,
    obj: &Bound<PyModule>,
    values: &mut HashMap<JsonObjectId, JsonObject<'a>>,
) -> JsonObject<'a> {
    let name = PyModuleMethods::name(obj);
    let dict = PyModuleMethods::dict(obj);
    let children = PyDictMethods::iter(&dict)
        .map(|(k, v)| (k.to_string().into(), create_jobject_helper(py, &v, values)))
        .collect();
    JsonObject {
        id: 0,
        repr: format!(
            "module {}",
            name.as_ref()
                .map(|s| s.to_string_lossy())
                .unwrap_or("".into())
        )
        .into(),
        value_type: "".into(),
        kind: "module",
        children,
    }
}

fn create_class<'a>(
    _py: &Python,
    obj: &Bound<PyType>,
    _values: &mut HashMap<JsonObjectId, JsonObject<'a>>,
) -> JsonObject<'a> {
    let name = PyTypeMethods::name(obj);
    let children = Vec::new();
    JsonObject {
        id: 0,
        repr: format!(
            "class {}",
            name.as_ref()
                .map(|s| s.to_string_lossy())
                .unwrap_or("".into())
        )
        .into(),
        value_type: "".into(),
        kind: "class",
        children,
    }
}

fn create_jobject_helper<'a>(
    py: &Python,
    obj: &Bound<PyAny>,
    values: &mut HashMap<JsonObjectId, JsonObject<'a>>,
) -> JsonObjectId {
    let id = obj.as_ptr() as u64;
    if values.contains_key(&id) {
        return id;
    }
    let mut value = if obj.is_none() {
        simple_value("None".into(), "".into(), "null")
    } else if let Ok(obj) = obj.downcast_exact::<PyInt>() {
        simple_value(obj.to_string().into(), "int".into(), "number")
    } else if let Ok(obj) = obj.downcast_exact::<PyFloat>() {
        simple_value(obj.to_string().into(), "float".into(), "number")
    } else if let Ok(obj) = obj.downcast_exact::<PyString>() {
        simple_value(
            format!("\"{}\"", PyStringMethods::to_str(obj).unwrap_or_default()).into(),
            "str".into(),
            "string",
        )
    } else if let Ok(obj) = obj.downcast_exact::<PyList>() {
        create_list(py, obj, values)
    } else if let Ok(obj) = obj.downcast_exact::<PyType>() {
        create_class(py, obj, values)
    } else if let Ok(obj) = obj.downcast_exact::<PyModule>() {
        create_module(py, obj, values)
    } else {
        let value_type = string_value(obj.get_type().qualname());
        let repr = string_value(obj.repr());
        simple_value(repr.into(), value_type.into(), "")
    };
    value.id = id;
    values.insert(id, value);
    id
}
