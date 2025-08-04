use crate::notebook::{
    EditorGroup, EditorId, KernelId, NotebookId, OutputCell, OutputCellId, OutputValue, RunId,
};
use axum::extract::ws::Message;
use comm::messages::OutputFlag;
use comm::scopes::{SerializedGlobals, SerializedGlobalsUpdate};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum FromClientMessage {
    CreateNewNotebook(CreateNewNotebookMsg),
    CreateNewKernel(CreateNewKernelMsg),
    RunCode(RunCodeMsg),
    SaveNotebook(SaveNotebookMsg),
    LoadNotebook(LoadNotebookMsg),
    QueryDir,
    CloseRun(NotebookRunMsg),
    KernelList,
    Fork(ForkMsg),
}

#[derive(Debug, Deserialize)]
pub(crate) struct NotebookRunMsg {
    pub notebook_id: NotebookId,
    pub run_id: RunId,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CreateNewNotebookMsg {
    pub filename: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CreateNewKernelMsg {
    pub notebook_id: NotebookId,
    pub run_id: RunId,
    pub run_title: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RunCodeMsg {
    pub notebook_id: NotebookId,
    pub run_id: RunId,
    pub cell_id: OutputCellId,
    pub editor_node: EditorGroup,
    pub called_id: EditorId,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ForkMsg {
    pub notebook_id: NotebookId,
    pub run_id: RunId,
    pub new_run_id: RunId,
    pub new_run_title: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SaveNotebookMsg {
    pub notebook_id: NotebookId,
    pub editor_root: EditorGroup,
}

#[derive(Debug, Deserialize)]
pub(crate) struct LoadNotebookMsg {
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub(crate) enum KernelStateDesc {
    Init,
    Ready,
    Running,
    Crashed { message: String },
    Closed,
}

#[derive(Debug, Serialize)]
pub(crate) struct RunDesc<'a> {
    pub id: RunId,
    pub title: &'a str,
    pub output_cells: &'a [OutputCell],
    pub kernel_state: KernelStateDesc,
    pub globals: &'a SerializedGlobals,
}

#[derive(Debug, Serialize)]
pub(crate) struct NotebookDesc<'a> {
    pub id: NotebookId,
    pub path: &'a str,
    pub editor_root: &'a EditorGroup,
    pub editor_open_nodes: &'a [EditorId],
    pub runs: Vec<RunDesc<'a>>,
}

#[derive(Debug, Serialize)]
pub(crate) enum DirEntryType {
    Notebook,
    LoadedNotebook,
    File,
    Dir,
}

#[derive(Debug, Serialize)]
pub(crate) struct DirEntry {
    pub path: String,
    pub entry_type: DirEntryType,
}

#[derive(Debug, Serialize)]
pub(crate) struct KernelInfo {
    pub kernel_id: KernelId,
    pub notebook_id: NotebookId,
    pub run_id: RunId,
    pub pid: u32,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub(crate) enum ToClientMessage<'a> {
    Error {
        message: &'a str,
    },
    NewNotebook {
        notebook: NotebookDesc<'a>,
    },
    KernelReady {
        notebook_id: NotebookId,
        run_id: RunId,
    },
    KernelCrashed {
        notebook_id: NotebookId,
        run_id: RunId,
        message: String,
    },
    Output {
        notebook_id: NotebookId,
        run_id: RunId,
        cell_id: OutputCellId,
        value: &'a OutputValue,
        flag: OutputFlag,
        update: Option<&'a SerializedGlobalsUpdate>,
        kernel_state: KernelStateDesc,
    },
    NewGlobals {
        notebook_id: NotebookId,
        run_id: RunId,
        globals: SerializedGlobals,
    },
    SaveCompleted {
        notebook_id: NotebookId,
        error: Option<String>,
    },
    DirList {
        entries: &'a [DirEntry],
    },
    Kernels {
        kernels: Vec<KernelInfo>,
    },
}

pub(crate) fn parse_client_message(message: Message) -> anyhow::Result<FromClientMessage> {
    Ok(serde_json::from_str::<FromClientMessage>(
        message.to_text()?,
    )?)
}

pub(crate) fn serialize_client_message(message: ToClientMessage) -> anyhow::Result<Message> {
    Ok(Message::Text(serde_json::to_string(&message)?.into()))
}
