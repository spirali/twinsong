use crate::client_messages::{
    KernelStateDesc, NotebookDesc, RunDesc, ToClientMessage, serialize_client_message,
};
use anyhow::anyhow;
use axum::extract::ws::Message;
use comm::messages::{
    CodeGroup, CodeLeaf, CodeNode, CodeScope, Exception, KernelOutputValue, OutputFlag,
    OwnCodeScope,
};
use comm::scopes::{SerializedGlobals, SerializedGlobalsUpdate};
use jiff::Timestamp;
use nutype::nutype;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum EditorNode {
    Group(EditorGroup),
    Cell(EditorCell),
}

impl EditorNode {
    pub fn to_code_node(&self) -> CodeNode {
        match self {
            EditorNode::Group(group) => CodeNode::Group(group.to_code_group()),
            EditorNode::Cell(cell) => CodeNode::Leaf(CodeLeaf {
                id: cell.id.into_inner(),
                code: cell.code.clone(),
            }),
        }
    }
    pub fn collect_group_ids(&self, out: &mut Vec<EditorId>) {
        match self {
            EditorNode::Group(group) => group.collect_group_ids(out),
            EditorNode::Cell(_) => {}
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) enum ScopeType {
    Own,
    Inherit,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct EditorGroup {
    pub id: EditorId,
    pub name: String,
    pub children: Vec<EditorNode>,
    pub scope: ScopeType,
}

impl EditorGroup {
    pub fn collect_group_ids(&self, out: &mut Vec<EditorId>) {
        out.push(self.id);
        for child in &self.children {
            child.collect_group_ids(out);
        }
    }

    pub fn to_code_group(&self) -> CodeGroup {
        CodeGroup {
            children: self
                .children
                .iter()
                .map(|child| child.to_code_node())
                .collect(),
            scope: match self.scope {
                ScopeType::Own => CodeScope::Own(OwnCodeScope {
                    id: self.id.into_inner(),
                    name: self.name.clone(),
                }),
                ScopeType::Inherit => CodeScope::Inherit,
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct EditorCell {
    pub id: EditorId,
    pub code: String,
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
    editor_node: EditorGroup,
    called_id: EditorId,
}

impl OutputCell {
    pub fn new(id: OutputCellId, editor_node: EditorGroup, called_id: EditorId) -> Self {
        OutputCell {
            id,
            values: Vec::new(),
            flag: OutputFlag::Running,
            editor_node,
            called_id,
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
pub(crate) struct EditorId(Uuid);

//#[allow(dead_code)] // TODO: Remove this when Run saving is implemented

#[derive(Debug)]
pub enum KernelState {
    Init(KernelId),
    Running(KernelId),
    Crashed(String),
    Closed,
}

// #[derive(Debug, Serialize, Deserialize, Default)]
// #[serde(transparent)]
// pub struct ScopedObjects(Vec<(ScopeId, Vec<(String, Arc<String>)>)>);
//
// impl ScopedObjects {
//     pub fn update(&mut self, update: ScopeUpdates) {
//         let mut old = self.0.drain(..).collect::<HashMap<_, _>>();
//         for (key, ups) in update {
//             for up in ups {}
//             let data = up.1.unwrap_or_else(|| old.remove(&up.0).unwrap());
//             self.0.push((up.0, data));
//         }
//     }
// }

#[derive(Debug)]
pub(crate) struct Run {
    title: String,
    output_cells: Vec<OutputCell>,
    kernel: KernelState,
    queue: usize,
    globals: SerializedGlobals,
    created: Timestamp,
}

impl Run {
    pub fn new(
        title: String,
        output_cells: Vec<OutputCell>,
        kernel: KernelState,
        globals: SerializedGlobals,
        created: Timestamp,
    ) -> Self {
        Run {
            title,
            output_cells,
            kernel,
            queue: 0,
            globals,
            created,
        }
    }
    pub fn created(&self) -> Timestamp {
        self.created
    }
    pub fn set_crashed_kernel(&mut self, message: String) {
        self.queue = 0;
        self.kernel = KernelState::Crashed(message)
    }
    pub fn queue_increment(&mut self) {
        self.queue += 1;
    }
    pub fn queue_decrement(&mut self) {
        assert!(self.queue > 0);
        self.queue -= 1;
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

    pub fn update_globals(&mut self, update: SerializedGlobalsUpdate) {
        self.globals = update.apply(Some(&mut self.globals));
    }

    pub fn globals(&self) -> &SerializedGlobals {
        &self.globals
    }

    pub fn add_output(&mut self, cell_id: OutputCellId, value: OutputValue, flag: OutputFlag) {
        if let Some(ref mut last) = self.output_cells.iter_mut().rev().find(|c| c.id == cell_id) {
            if let (
                OutputFlag::Running,
                OutputValue::Text { value: new_text },
                Some(OutputValue::Text { value: old_text }),
            ) = (flag, &value, last.values.last_mut())
            {
                old_text.push_str(new_text);
                last.flag = flag;
                return;
            }
            last.values.push(value);
            last.flag = flag;
        } else {
            panic!("Output cell with id {} not found", cell_id);
        }
    }

    pub fn kernel_state_desc(&self) -> KernelStateDesc {
        match self.kernel_state() {
            KernelState::Init(_) => KernelStateDesc::Init,
            KernelState::Running(_) => {
                if self.queue > 0 {
                    KernelStateDesc::Running
                } else {
                    KernelStateDesc::Ready
                }
            }
            KernelState::Crashed(s) => KernelStateDesc::Crashed { message: s.clone() },
            KernelState::Closed => KernelStateDesc::Closed,
        }
    }
}

pub(crate) struct Notebook {
    pub editor_root: EditorGroup,
    pub editor_open_nodes: Vec<EditorId>,
    pub path: String,
    pub runs: HashMap<RunId, Run>,
    pub run_order: Vec<RunId>,
    pub observer: Option<UnboundedSender<Message>>,
}

impl Notebook {
    pub fn new(path: String) -> Self {
        /*let editor_cells = vec![
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
        ];*/
        let editor_root = EditorGroup {
            id: EditorId::new(Uuid::new_v4()),
            name: "project".to_string(),
            scope: ScopeType::Own,
            children: vec![
                EditorNode::Cell(EditorCell {
                    id: EditorId::new(Uuid::new_v4()),
                    code: "print(\"Hello world\")\n\nx = 10\nx".to_string(),
                }),
                EditorNode::Cell(EditorCell {
                    id: EditorId::new(Uuid::new_v4()),
                    code: "".to_string(),
                }),
            ],
        };
        let mut editor_open_nodes = Vec::new();
        editor_root.collect_group_ids(&mut editor_open_nodes);
        Notebook {
            path,
            editor_root,
            editor_open_nodes,
            runs: Default::default(),
            run_order: Vec::new(),
            observer: None,
        }
    }

    pub fn set_observer(&mut self, sender: UnboundedSender<Message>) {
        if let Some(_observer) = &self.observer {
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

    pub fn remove_run_by_id(&mut self, run_id: RunId) -> anyhow::Result<Run> {
        self.run_order.retain(|r_id| run_id != *r_id);
        self.runs
            .remove(&run_id)
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
                    kernel_state: run.kernel_state_desc(),
                    globals: &run.globals,
                }
            })
            .collect::<Vec<_>>();
        NotebookDesc {
            id: notebook_id,
            path: &self.path,
            editor_root: &self.editor_root,
            editor_open_nodes: &self.editor_open_nodes,
            runs,
        }
    }
}

pub(crate) fn generate_new_notebook_path() -> anyhow::Result<String> {
    for i in 1..300 {
        let candidate = format!("notebook_{i}.tsnb");
        if !std::fs::exists(Path::new(&candidate)).unwrap_or(true) {
            return Ok(candidate);
        }
    }
    Err(anyhow!("Cannot generate new notebook path"))
}
