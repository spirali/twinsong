use pyo3::types::{
    PyAnyMethods, PyDict, PyDictMethods, PyFloat, PyInt, PyList, PyListMethods, PyModule,
    PyModuleMethods, PyString, PyStringMethods, PyTuple, PyTupleMethods, PyType, PyTypeMethods,
};
use pyo3::{Bound, PyAny, PyResult, Python};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};

use serde::Serialize;

pub type JsonObjectId = u64;

#[derive(Debug, Serialize)]
pub struct JsonObjectDump {
    pub objects: Vec<JsonObject>,
    pub root: JsonObjectId,
}

#[derive(Debug, Serialize)]
pub struct JsonObject {
    pub id: JsonObjectId,
    pub repr: String,

    #[serde(skip_serializing_if = "str::is_empty")]
    pub value_type: Cow<'static, str>,

    #[serde(skip_serializing_if = "str::is_empty")]
    pub kind: &'static str,

    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<(String, JsonObjectId)>,
}

#[derive(Debug)]
enum TypeCollection<'a> {
    Unknown,
    Unique(Cow<'a, str>),
    Many,
}

struct BuildCtx {
    serialized: HashSet<JsonObjectId>,
    objects: HashMap<JsonObjectId, JsonObject>,
}

impl BuildCtx {
    fn new() -> Self {
        BuildCtx {
            serialized: Default::default(),
            objects: Default::default(),
        }
    }
}

impl<'a> TypeCollection<'a> {
    #[allow(clippy::ptr_arg)]
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

fn create_name_1<'b>(tc: TypeCollection, name: &'b str) -> Cow<'b, str> {
    match tc {
        TypeCollection::Unknown | TypeCollection::Many => name.into(),
        TypeCollection::Unique(t) => format!("{name}[{}]", t.as_ref()).into(),
    }
}

fn create_name_2<'b>(tc1: TypeCollection, tc2: TypeCollection, name: &'b str) -> Cow<'b, str> {
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

pub fn create_jobject_dump(py: Python, obj: &Bound<PyAny>) -> JsonObjectDump {
    let mut ctx = BuildCtx::new();
    let root = create_jobject_helper(py, &mut ctx, obj);
    JsonObjectDump {
        objects: ctx.objects.into_values().collect(),
        root,
    }
}

fn simple_value(repr: String, value_type: Cow<'static, str>, kind: &'static str) -> JsonObject {
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
        .map(|o| o.to_string_lossy().to_string())
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
    ctx: &'a BuildCtx,
    children: &[(String, JsonObjectId)],
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
    } else if obj.downcast_exact::<PyInt>().is_ok() {
        "int".into()
    } else if obj.downcast_exact::<PyFloat>().is_ok() {
        "float".into()
    } else if obj.downcast_exact::<PyString>().is_ok() {
        "str".into()
    } else if obj.downcast_exact::<PyTuple>().is_ok() {
        "tuple".into()
    } else if obj.downcast_exact::<PyList>().is_ok() {
        "list".into()
    } else if obj.downcast_exact::<PyDict>().is_ok() {
        "dict".into()
    } else if obj.downcast_exact::<PyType>().is_ok() {
        "type".into()
    } else {
        obj.get_type().to_string().into()
    }
}

fn create_dict(py: Python, ctx: &mut BuildCtx, obj: &Bound<PyDict>) -> JsonObject {
    let mut tc1 = TypeCollection::Unknown;
    let children: Vec<_> = obj
        .into_iter()
        .map(|(slot, child)| {
            if !tc1.is_many() {
                tc1.add(&short_type(&slot));
            }
            (slot.to_string(), create_jobject_helper(py, ctx, &child))
        })
        .collect();
    let repr = container_repr(obj, PyDictMethods::len(obj));
    let tc2 = find_children_element_type(ctx, &children);
    JsonObject {
        id: 0,
        repr,
        value_type: create_name_2(tc1, tc2, "dict"),
        kind: "dict",
        children,
    }
}

fn create_list<'a>(py: Python, ctx: &'a mut BuildCtx, obj: &'a Bound<PyList>) -> JsonObject {
    let children: Vec<_> = obj
        .into_iter()
        .enumerate()
        .map(|(idx, child)| (idx.to_string(), create_jobject_helper(py, ctx, &child)))
        .collect();
    let repr = container_repr(obj, PyListMethods::len(obj));
    let tc = find_collection_element_type(
        children
            .iter()
            .filter_map(|(_, id)| ctx.objects.get(id).map(|x| &x.value_type)),
    );
    JsonObject {
        id: 0,
        repr,
        value_type: create_name_1(tc, "list"),
        kind: "list",
        children,
    }
}

fn create_tuple(py: Python, ctx: &mut BuildCtx, obj: &Bound<PyTuple>) -> JsonObject {
    let children: Vec<_> = obj
        .into_iter()
        .enumerate()
        .map(|(idx, child)| (idx.to_string(), create_jobject_helper(py, ctx, &child)))
        .collect();
    let repr = container_repr(obj, PyTupleMethods::len(obj));
    let tc = find_collection_element_type(
        children
            .iter()
            .filter_map(|(_, id)| ctx.objects.get(id).map(|x| &x.value_type)),
    );
    JsonObject {
        id: 0,
        repr,
        value_type: create_name_1(tc, "tuple"),
        kind: "tuple",
        children,
    }
}

fn create_module(py: Python, ctx: &mut BuildCtx, obj: &Bound<PyModule>) -> JsonObject {
    let name = PyModuleMethods::name(obj);
    let dict = PyModuleMethods::dict(obj);
    let children = PyDictMethods::iter(&dict)
        .map(|(k, v)| (k.to_string(), create_jobject_helper(py, ctx, &v)))
        .collect();
    //let children = Vec::new();
    JsonObject {
        id: 0,
        repr: format!(
            "module {}",
            name.as_ref()
                .map(|s| s.to_string_lossy())
                .unwrap_or("".into())
        ),
        value_type: "".into(),
        kind: "module",
        children,
    }
}

fn create_class(_py: Python, _ctx: &mut BuildCtx, obj: &Bound<PyType>) -> JsonObject {
    let name = PyTypeMethods::name(obj);
    let children = Vec::new();
    JsonObject {
        id: 0,
        repr: format!(
            "class {}",
            name.as_ref()
                .map(|s| s.to_string_lossy())
                .unwrap_or("".into())
        ),
        value_type: "".into(),
        kind: "class",
        children,
    }
}

// TODO: Cache import and getattr
fn try_create_dataclass(
    py: Python,
    ctx: &mut BuildCtx,
    obj: &Bound<PyAny>,
) -> PyResult<Option<JsonObject>> {
    let m = py.import("dataclasses")?;
    let f = m.getattr("is_dataclass")?;
    if !(f.call1((obj,))?.is_truthy()?) {
        return Ok(None);
    }
    let f = m.getattr("fields")?;
    let r = f.call1((obj,))?;
    let fields = r.downcast_exact::<PyTuple>()?;
    let mut len = 0;
    let children = fields
        .iter()
        .map(|field| {
            len += 1;
            let name = field.getattr("name")?.to_string();
            let child = obj.getattr(&name)?;
            Ok((name, create_jobject_helper(py, ctx, &child)))
        })
        .collect::<PyResult<Vec<_>>>()?;
    Ok(Some(JsonObject {
        id: 0,
        repr: container_repr(obj, len),
        value_type: string_value(obj.get_type().name()).into(),
        kind: "dataclass",
        children,
    }))
}

fn create_jobject_helper<'a>(
    py: Python<'a>,
    ctx: &'a mut BuildCtx,
    obj: &'a Bound<PyAny>,
) -> JsonObjectId {
    let id = obj.as_ptr() as u64;
    if ctx.serialized.contains(&id) {
        return id;
    }
    ctx.serialized.insert(id);
    let mut value = if obj.is_none() {
        simple_value("None".into(), "".into(), "null")
    } else if let Ok(obj) = obj.downcast_exact::<PyInt>() {
        simple_value(obj.to_string(), "int".into(), "number")
    } else if let Ok(obj) = obj.downcast_exact::<PyFloat>() {
        simple_value(obj.to_string(), "float".into(), "number")
    } else if let Ok(obj) = obj.downcast_exact::<PyString>() {
        simple_value(
            format!("\"{}\"", PyStringMethods::to_str(obj).unwrap_or_default()),
            "str".into(),
            "string",
        )
    } else if let Ok(obj) = obj.downcast_exact::<PyTuple>() {
        create_tuple(py, ctx, obj)
    } else if let Ok(obj) = obj.downcast_exact::<PyList>() {
        create_list(py, ctx, obj)
    } else if let Ok(obj) = obj.downcast_exact::<PyDict>() {
        create_dict(py, ctx, obj)
    } else if let Ok(obj) = obj.downcast_exact::<PyType>() {
        create_class(py, ctx, obj)
    } else if let Some(obj) = try_create_dataclass(py, ctx, obj).unwrap() {
        // TODO: Handle errors
        obj
    } else if let Ok(obj) = obj.downcast_exact::<PyModule>() {
        create_module(py, ctx, obj)
    } else {
        let value_type = string_value(obj.get_type().qualname());
        let repr = string_value(obj.repr());
        let kind = if let Ok(true) = py
            .import("builtins")
            .and_then(|m| m.getattr("callable"))
            .and_then(|f| f.call1((obj,)))
            .and_then(|r| r.is_truthy())
        {
            "callable"
        } else {
            ""
        };
        simple_value(repr, value_type.into(), kind)
    };
    value.id = id;
    ctx.objects.insert(id, value);
    id
}
