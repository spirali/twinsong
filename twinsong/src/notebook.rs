use crate::client_messages::{serialize_client_message, NotebookDesc, ToClientMessage};
use crate::kernel::KernelHandle;
use anyhow::anyhow;
use axum::extract::ws::Message;
use comm::messages::{OutputFlag, OutputValue};
use nutype::nutype;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::{Display, Formatter};
use std::path::{Path, PathBuf};
use std::process::Output;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct EditorCell {
    pub id: Uuid,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct OutputCell {
    id: OutputCellId,
    values: Vec<OutputValue>,
    flag: OutputFlag,
}

#[nutype(derive(
    Display,
    Debug,
    PartialEq,
    Hash,
    Eq,
    Serialize,
    Deserialize,
    Copy,
    Clone
))]
pub(crate) struct NotebookId(u32);

#[nutype(derive(
    Display,
    Debug,
    PartialEq,
    Hash,
    Eq,
    Serialize,
    Deserialize,
    Copy,
    Clone
))]
pub(crate) struct RunId(Uuid);

#[nutype(derive(
    Display,
    Debug,
    PartialEq,
    Hash,
    Eq,
    Serialize,
    Deserialize,
    Copy,
    Clone
))]
pub(crate) struct KernelId(Uuid);

#[nutype(derive(
    Display,
    Debug,
    PartialEq,
    Hash,
    Eq,
    Serialize,
    Deserialize,
    Copy,
    Clone
))]
pub(crate) struct OutputCellId(Uuid);

//#[allow(dead_code)] // TODO: Remove this when Run saving is implemented
pub(crate) struct Run {
    title: String,
    output_cells: Vec<OutputCell>,
    kernel: Option<KernelId>,
}

pub(crate) struct Notebook {
    pub editor_cells: Vec<EditorCell>,
    pub path: String,
    pub runs: HashMap<RunId, Run>,
    pub run_order: Vec<RunId>,
    pub observers: Vec<UnboundedSender<Message>>,
}

impl Notebook {
    pub fn new(path: String) -> Self {
        let editor_cells = vec![
            EditorCell {
                id: Uuid::new_v4(),
                value: "a = 10\na + 2".to_string(),
            },
            EditorCell {
                id: Uuid::new_v4(),
                value:
                    "import pandas as pd\n\npd.DataFrame([(10, 20), (30, 40)], columns=[\"Aa\", \"Bb\"])"
                        .to_string(),
            },
            EditorCell {
                id: Uuid::new_v4(),
                value:
                "import time\nfor x in range(4):\n    print(x)\n    time.sleep(1)\n"
                    .to_string(),
            },

        ];
        Notebook {
            path,
            editor_cells,
            runs: Default::default(),
            run_order: Vec::new(),
            observers: Vec::new(),
        }
    }

    pub fn add_observer(&mut self, sender: UnboundedSender<Message>) {
        self.observers.push(sender);
    }

    pub fn add_run(&mut self, run_id: RunId, run: Run) {
        assert!(self.runs.insert(run_id, run).is_none());
        self.run_order.push(run_id);
    }

    pub fn send_message(&self, message: ToClientMessage) {
        if self.observers.is_empty() {
            return;
        }
        let data = serialize_client_message(message).unwrap();
        for observer in &self.observers[1..] {
            let _ = observer.send(data.clone());
        }
        let _ = self.observers[0].send(data);
    }

    pub fn find_run_by_id_mut(&mut self, run_id: RunId) -> anyhow::Result<&mut Run> {
        self.runs
            .get_mut(&run_id)
            .ok_or_else(|| anyhow!(format!("Run {run_id} not found")))
    }

    pub fn notebook_desc(&self, notebook_id: NotebookId) -> NotebookDesc {
        NotebookDesc {
            id: notebook_id,
            path: &self.path,
            editor_cells: &self.editor_cells,
        }
    }
}

impl Run {
    pub fn new(title: String, kernel: Option<KernelId>) -> Self {
        Run {
            title,
            output_cells: Vec::new(),
            kernel,
        }
    }

    pub fn kernel_id(&mut self) -> Option<KernelId> {
        self.kernel
    }

    pub fn add_output(&mut self, cell_id: OutputCellId, value: OutputValue, flag: OutputFlag) {
        if let Some(ref mut last) = self.output_cells.last_mut().filter(|c| c.id == cell_id) {
            if let OutputValue::Text { value: new_text } = &value {
                if let Some(OutputValue::Text { value: old_text }) = last.values.last_mut() {
                    old_text.push_str(&new_text);
                    return;
                }
            }
            last.values.push(value);
            last.flag = flag;
        } else {
            self.output_cells.push(OutputCell {
                id: cell_id,
                values: vec![value],
                flag,
            });
        }
    }
}

pub(crate) fn generate_new_notebook_path() -> anyhow::Result<String> {
    for i in 1..300 {
        let candidate = format!("new_notebook_{i}");
        if !std::fs::exists(&Path::new(&candidate)).unwrap_or(true) {
            return Ok(candidate);
        }
    }
    Err(anyhow!("Cannot generate new notebook path"))
}
