use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ComputeMsg {
    pub cell_id: Uuid,
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ToKernelMessage {
    Compute(ComputeMsg),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FinishedMsg {
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum OutputFlag {
    Running,
    Success,
    Fail,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Exception {
    pub message: String,
    pub traceback: String,
}

/*
   We are using different output value for in kernel and from kernel communication
   because bincode breaks when serde(tag = ...) is used on this enum,
   but we want OutputValue serialized to JSON with tag
*/
#[derive(Debug, Serialize, Deserialize)]
pub enum KernelOutputValue {
    Text { value: String },
    Html { value: String },
    Exception { value: Exception },
    None,
}

pub type GlobalsUpdate = Vec<(String, Option<Arc<String>>)>;

#[derive(Debug, Serialize, Deserialize)]
pub enum FromKernelMessage {
    Login {
        kernel_id: Uuid,
    },
    Output {
        value: KernelOutputValue,
        cell_id: Uuid,
        flag: OutputFlag,
        globals: Option<GlobalsUpdate>,
    },
}
