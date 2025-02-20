use crate::client_messages::{serialize_client_message, ToClientMessage};
use crate::define_id_type;
use crate::kernel::KernelHandle;
use axum::extract::ws::Message;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct EditorCell {
    pub id: Uuid,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct OutputCell {
    value: String,
}

define_id_type!(NotebookId, u32);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[serde(transparent)]
#[repr(transparent)]
pub(crate) struct RunId(Uuid);

impl Default for RunId {
    fn default() -> Self {
        Self::new()
    }
}

impl RunId {
    pub fn new() -> Self {
        RunId(Uuid::new_v4())
    }

    pub fn from(uuid: Uuid) -> Self {
        RunId(uuid)
    }
}

impl Display for RunId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[serde(transparent)]
#[repr(transparent)]
pub struct OutputCellId(Uuid);

impl Default for OutputCellId {
    fn default() -> Self {
        Self::new()
    }
}

impl OutputCellId {
    pub fn new() -> Self {
        OutputCellId(Uuid::new_v4())
    }

    pub fn from(uuid: Uuid) -> Self {
        OutputCellId(uuid)
    }

    pub fn as_uuid(&self) -> Uuid {
        self.0
    }
}

impl Display for OutputCellId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[allow(dead_code)] // TODO: Remove this when Run saving is implemented
pub(crate) struct Run {
    title: String,
    output_cells: Vec<OutputCell>,
    notebook_id: NotebookId,
    kernel: Option<KernelHandle>,
}

pub(crate) struct Notebook {
    pub id: NotebookId,
    pub editor_cells: Vec<EditorCell>,
    pub title: String,
    pub runs: Vec<RunId>,
    pub observers: Vec<UnboundedSender<Message>>,
}

impl Notebook {
    pub fn new(id: NotebookId, title: String) -> Self {
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
            id,
            title,
            editor_cells,
            runs: Default::default(),
            observers: Vec::new(),
        }
    }

    pub fn add_observer(&mut self, sender: UnboundedSender<Message>) {
        self.observers.push(sender);
    }

    pub fn add_run(&mut self, run_id: RunId) {
        self.runs.push(run_id);
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
}

impl Run {
    pub fn new(notebook_id: NotebookId, title: String, kernel: Option<KernelHandle>) -> Self {
        Run {
            title,
            output_cells: Vec::new(),
            notebook_id,
            kernel,
        }
    }

    pub fn kernel_mut(&mut self) -> Option<&mut KernelHandle> {
        self.kernel.as_mut()
    }

    pub fn notebook_id(&self) -> NotebookId {
        self.notebook_id
    }
}
