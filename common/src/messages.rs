use crate::scopes::SerializedGlobalsUpdate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnCodeScope {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CodeScope {
    Own(OwnCodeScope),
    Inherit,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum CodeNode {
    Group(CodeGroup),
    Leaf(CodeLeaf),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeGroup {
    pub children: Vec<CodeNode>,
    pub scope: CodeScope,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeLeaf {
    pub id: Uuid,
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComputeMsg {
    pub cell_id: Uuid,
    pub code: CodeGroup,
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

impl OutputFlag {
    pub fn is_final(&self) -> bool {
        match self {
            OutputFlag::Running => false,
            OutputFlag::Success | OutputFlag::Fail => true,
        }
    }
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

#[derive(Debug, Serialize, Deserialize)]
pub enum FromKernelMessage {
    Login {
        kernel_id: Uuid,
    },
    Output {
        value: KernelOutputValue,
        cell_id: Uuid,
        flag: OutputFlag,
        update: Option<SerializedGlobalsUpdate>,
    },
}
