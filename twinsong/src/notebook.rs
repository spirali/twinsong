use crate::client_messages::{
    serialize_client_message, KernelStateDesc, NotebookDesc, RunDesc, ToClientMessage,
};
use crate::kernel::KernelHandle;
use anyhow::anyhow;
use axum::extract::ws::Message;
use comm::messages::{Exception, KernelOutputValue, OutputFlag};
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
#[serde(tag = "type")]
pub enum OutputValue {
    Text { value: String },
    Html { value: String },
    Exception { value: Exception },
    None,
}

impl OutputValue {
    pub fn new(value: KernelOutputValue) -> Self {
        match value {
            KernelOutputValue::Text { value } => OutputValue::Text { value },
            KernelOutputValue::Html { value } => OutputValue::Html { value },
            KernelOutputValue::Exception { value } => OutputValue::Exception { value },
            KernelOutputValue::None => OutputValue::None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct OutputCell {
    id: OutputCellId,
    // If flag is finished/failed then the last value is returned object/exception
    values: Vec<OutputValue>,
    flag: OutputFlag,
    editor_cell: EditorCell,
}

impl OutputCell {
    pub fn new(id: OutputCellId, editor_cell: EditorCell) -> Self {
        OutputCell {
            id,
            values: Vec::new(),
            flag: OutputFlag::Running,
            editor_cell,
        }
    }
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

#[derive(Debug)]
pub enum KernelState {
    Init(KernelId),
    Running(KernelId),
    Crashed(String),
    Closed,
}

#[derive(Debug)]
pub(crate) struct Run {
    title: String,
    output_cells: Vec<OutputCell>,
    kernel: KernelState,
}

impl Run {
    pub fn new(title: String, output_cells: Vec<OutputCell>, kernel: KernelState) -> Self {
        Run {
            title,
            output_cells,
            kernel,
        }
    }
    pub fn set_crashed_kernel(&mut self, message: String) {
        self.kernel = KernelState::Crashed(message)
    }
    pub fn set_running_kernel(&mut self, kernel_id: KernelId) {
        assert!(matches!(self.kernel, KernelState::Init(id) if id == kernel_id));
        self.kernel = KernelState::Running(kernel_id);
    }
    pub fn kernel_state(&self) -> &KernelState {
        &self.kernel
    }
    pub fn title(&self) -> &str {
        &self.title
    }
    pub fn output_cells(&self) -> &[OutputCell] {
        &self.output_cells
    }
    pub fn kernel_id(&mut self) -> Option<KernelId> {
        match &self.kernel {
            KernelState::Init(kernel_id) | KernelState::Running(kernel_id) => Some(*kernel_id),
            KernelState::Crashed(_) | KernelState::Closed => None,
        }
    }

    pub fn add_output_cell(&mut self, output_cell: OutputCell) {
        self.output_cells.push(output_cell);
    }

    pub fn add_output(&mut self, cell_id: OutputCellId, value: OutputValue, flag: OutputFlag) {
        if let Some(ref mut last) = self.output_cells.iter_mut().rev().find(|c| c.id == cell_id) {
            if let (
                OutputFlag::Running,
                OutputValue::Text { value: new_text },
                Some(OutputValue::Text { value: old_text }),
            ) = (flag, &value, last.values.last_mut())
            {
                old_text.push_str(&new_text);
                last.flag = flag;
                return;
            }
            last.values.push(value);
            last.flag = flag;
        } else {
            panic!("Output cell with id {} not found", cell_id);
        }
    }
}

pub(crate) struct Notebook {
    pub editor_cells: Vec<EditorCell>,
    pub path: String,
    pub runs: HashMap<RunId, Run>,
    pub run_order: Vec<RunId>,
    pub observer: Option<UnboundedSender<Message>>,
}

impl Notebook {
    pub fn new(path: String) -> Self {
        let editor_cells = vec![
            EditorCell {
                id: Uuid::new_v4(),
                value: "print(\"Hello world\")".to_string(),
            },
            EditorCell {
                id: Uuid::new_v4(),
                value: String::new(),
            },
            /*EditorCell {
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
            },*/
        ];
        Notebook {
            path,
            editor_cells,
            runs: Default::default(),
            run_order: Vec::new(),
            observer: None,
        }
    }

    pub fn set_observer(&mut self, sender: UnboundedSender<Message>) {
        if let Some(observer) = &self.observer {
            // TODO: Inform about disconnect
        }
        self.observer = Some(sender);
    }

    pub fn add_run(&mut self, run_id: RunId, run: Run) {
        assert!(self.runs.insert(run_id, run).is_none());
        self.run_order.push(run_id);
    }

    pub fn send_message(&self, message: ToClientMessage) {
        if let Some(observer) = &self.observer {
            let data = serialize_client_message(message).unwrap();
            let _ = observer.send(data);
        }
    }

    pub fn send_raw_message(&self, message: Message) {
        if let Some(observer) = &self.observer {
            let _ = observer.send(message);
        }
    }

    pub fn find_run_by_id_mut(&mut self, run_id: RunId) -> anyhow::Result<&mut Run> {
        self.runs
            .get_mut(&run_id)
            .ok_or_else(|| anyhow!(format!("Run {run_id} not found")))
    }

    pub fn runs(&self) -> impl Iterator<Item = (RunId, &Run)> + '_ {
        self.run_order
            .iter()
            .map(|run_id| (*run_id, self.runs.get(run_id).unwrap()))
    }

    pub fn notebook_desc(&self, notebook_id: NotebookId) -> NotebookDesc {
        let runs = self
            .run_order
            .iter()
            .map(|run_id| {
                let run = self.runs.get(run_id).unwrap();
                RunDesc {
                    id: *run_id,
                    title: &run.title,
                    output_cells: &run.output_cells,
                    kernel_state: match run.kernel_state() {
                        KernelState::Init(_) => KernelStateDesc::Init,
                        KernelState::Running(_) => KernelStateDesc::Running,
                        KernelState::Crashed(s) => KernelStateDesc::Crashed {
                            message: s.as_str(),
                        },
                        KernelState::Closed => KernelStateDesc::Closed,
                    },
                }
            })
            .collect::<Vec<_>>();
        NotebookDesc {
            id: notebook_id,
            path: &self.path,
            editor_cells: &self.editor_cells,
            runs,
        }
    }
}

pub(crate) fn generate_new_notebook_path() -> anyhow::Result<String> {
    for i in 1..300 {
        let candidate = format!("notebook_{i}.tsnb");
        if !std::fs::exists(&Path::new(&candidate)).unwrap_or(true) {
            return Ok(candidate);
        }
    }
    Err(anyhow!("Cannot generate new notebook path"))
}
