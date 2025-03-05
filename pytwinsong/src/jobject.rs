use pyo3::types::{
    PyAnyMethods, PyBool, PyDict, PyDictMethods, PyFloat, PyInt, PyList, PyListMethods, PyModule,
    PyModuleMethods, PyString, PyStringMethods, PyType, PyTypeMethods,
};
use pyo3::{Bound, PyAny, PyClass, PyErr, PyObject, PyResult, Python};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};

use serde::Serialize;
use uuid::Bytes;

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

struct BuildCtx<'a> {
    serialized: HashSet<JsonObjectId>,
    objects: HashMap<JsonObjectId, JsonObject<'a>>,
}

impl<'a> TypeCollection<'a> {
    pub fn add<'b>(&mut self, name: &'b Cow<'a, str>) {
        match self {
            TypeCollection::Unknown => *self = TypeCollection::Unique(name.clone()),
            TypeCollection::Unique(t) if t.as_ref() == name.as_ref() => { /* Do nothing */ }
            TypeCollection::Unique(_) => *self = TypeCollection::Many,
            TypeCollection::Many => { /* Do nothing */ }
        }
    }
    pub fn is_many(&self) -> bool {
        matches!(self, TypeCollection::Many)
    }
}

pub fn create_name_1<'b>(tc: TypeCollection, name: &'b str) -> Cow<'b, str> {
    match tc {
        TypeCollection::Unknown | TypeCollection::Many => name.into(),
        TypeCollection::Unique(t) => format!("{name}[{}]", t.as_ref()).into(),
    }
}

pub fn create_name_2<'b>(tc1: TypeCollection, tc2: TypeCollection, name: &'b str) -> Cow<'b, str> {
    match (tc1, tc2) {
        (TypeCollection::Unique(t1), TypeCollection::Unique(t2)) => {
            format!("{name}[{}, {}]", t1.as_ref(), t2.as_ref()).into()
        }
        _ => name.into(),
    }
}

pub fn create_jobject_string(py: Python, obj: &Bound<PyAny>) -> serde_json::Result<String> {
    serde_json::to_string(&create_jobject_dump(py, obj))
}

pub fn create_jobject_dump<'a>(py: Python, obj: &Bound<PyAny>) -> JsonObjectDump<'a> {
    let mut ctx = BuildCtx {
        serialized: Default::default(),
        objects: Default::default(),
    };
    let root = create_jobject_helper(&py, obj, &mut ctx);

    JsonObjectDump {
        objects: ctx.objects.into_values().collect(),
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

fn find_children_element_type<'a>(
    ctx: &'a BuildCtx<'a>,
    children: &[(Cow<'a, str>, JsonObjectId)],
) -> TypeCollection<'a> {
    find_collection_element_type(
        children
            .iter()
            .filter_map(|(_, id)| ctx.objects.get(id).map(|x| &x.value_type)),
    )
}

const MAX_CONTAINER_REPR: usize = 24;

fn container_repr(obj: &Bound<PyAny>, len: usize) -> String {
    if len <= 10 {
        if let Ok(r) = obj.repr() {
            let cow = PyStringMethods::to_string_lossy(&r);
            if cow.as_ref().len() <= MAX_CONTAINER_REPR {
                return cow.to_string();
            }
        }
    }
    format!("{} items", len)
}

fn short_type(obj: &Bound<PyAny>) -> Cow<'static, str> {
    if obj.is_none() {
        "NoneType".into()
    } else if let Ok(_) = obj.downcast_exact::<PyInt>() {
        "int".into()
    } else if let Ok(_) = obj.downcast_exact::<PyFloat>() {
        "float".into()
    } else if let Ok(_) = obj.downcast_exact::<PyString>() {
        "str".into()
    } else if let Ok(_) = obj.downcast_exact::<PyList>() {
        "list".into()
    } else if let Ok(_) = obj.downcast_exact::<PyDict>() {
        "dict".into()
    } else if let Ok(_) = obj.downcast_exact::<PyType>() {
        "type".into()
    } else {
        obj.get_type().to_string().into()
    }
}

fn create_dict<'a>(py: &Python, obj: &Bound<PyDict>, ctx: &mut BuildCtx<'a>) -> JsonObject<'a> {
    let mut tc1 = TypeCollection::Unknown;
    let children: Vec<_> = obj
        .into_iter()
        .map(|(slot, child)| {
            if !tc1.is_many() {
                tc1.add(&short_type(&slot));
            }
            (
                slot.to_string().into(),
                create_jobject_helper(py, &child, ctx),
            )
        })
        .collect();
    let repr = container_repr(obj, PyDictMethods::len(obj));
    let tc2 = find_children_element_type(ctx, &children);
    JsonObject {
        id: 0,
        repr: repr.into(),
        value_type: create_name_2(tc1, tc2, "dict"),
        kind: "dict",
        children,
    }
}

fn create_list<'a>(py: &Python, obj: &Bound<PyList>, ctx: &mut BuildCtx<'a>) -> JsonObject<'a> {
    let children: Vec<_> = obj
        .into_iter()
        .enumerate()
        .map(|(idx, child)| {
            (
                idx.to_string().into(),
                create_jobject_helper(py, &child, ctx),
            )
        })
        .collect();
    let repr = container_repr(obj, PyListMethods::len(obj));
    let tc = find_collection_element_type(
        children
            .iter()
            .filter_map(|(_, id)| ctx.objects.get(id).map(|x| &x.value_type)),
    );
    JsonObject {
        id: 0,
        repr: repr.into(),
        value_type: create_name_1(tc, "list"),
        kind: "list",
        children,
    }
}

fn create_module<'a>(py: &Python, obj: &Bound<PyModule>, ctx: &mut BuildCtx<'a>) -> JsonObject<'a> {
    let name = PyModuleMethods::name(obj);
    let dict = PyModuleMethods::dict(obj);
    let children = PyDictMethods::iter(&dict)
        .map(|(k, v)| (k.to_string().into(), create_jobject_helper(py, &v, ctx)))
        .collect();
    //let children = Vec::new();
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

fn create_class<'a>(_py: &Python, obj: &Bound<PyType>, ctx: &BuildCtx<'a>) -> JsonObject<'a> {
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
    ctx: &mut BuildCtx<'a>,
) -> JsonObjectId {
    let id = obj.as_ptr() as u64;
    if ctx.serialized.contains(&id) {
        return id;
    }
    ctx.serialized.insert(id);
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
        create_list(py, obj, ctx)
    } else if let Ok(obj) = obj.downcast_exact::<PyDict>() {
        create_dict(py, obj, ctx)
    } else if let Ok(obj) = obj.downcast_exact::<PyType>() {
        create_class(py, obj, ctx)
    } else if let Ok(obj) = obj.downcast_exact::<PyModule>() {
        create_module(py, obj, ctx)
    } else {
        let value_type = string_value(obj.get_type().qualname());
        let repr = string_value(obj.repr());
        simple_value(repr.into(), value_type.into(), "")
    };
    value.id = id;
    ctx.objects.insert(id, value);
    id
}
