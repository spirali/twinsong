use serde::{Deserialize, Serialize};
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

#[derive(Debug, Serialize, Deserialize)]
pub enum OutputFlag {
    Stream,
    Success,
    Fail,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Exception {
    pub message: String,
    pub traceback: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum OutputValue {
    Text { value: String },
    Html { value: String },
    Exception(Exception),
    None,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum FromKernelMessage {
    Login {
        run_id: Uuid,
    },
    Output {
        value: OutputValue,
        cell_id: Uuid,
        flag: OutputFlag,
    },
}
