use crate::notebook::{
    EditorCell, Globals, NotebookId, OutputCell, OutputCellId, OutputValue, RunId,
};
use axum::extract::ws::Message;
use comm::messages::{GlobalsUpdate, OutputFlag};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum FromClientMessage {
    CreateNewNotebook(CreateNewNotebookMsg),
    CreateNewKernel(CreateNewKernelMsg),
    RunCell(RunCellMsg),
    SaveNotebook(SaveNotebookMsg),
    LoadNotebook(LoadNotebookMsg),
    QueryDir,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CreateNewNotebookMsg {}

#[derive(Debug, Deserialize)]
pub(crate) struct CreateNewKernelMsg {
    pub notebook_id: NotebookId,
    pub run_id: RunId,
    pub run_title: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RunCellMsg {
    pub notebook_id: NotebookId,
    pub run_id: RunId,
    pub cell_id: OutputCellId,
    pub editor_cell: EditorCell,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SaveNotebookMsg {
    pub notebook_id: NotebookId,
    pub editor_cells: Vec<EditorCell>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct LoadNotebookMsg {
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub(crate) enum KernelStateDesc<'a> {
    Init,
    Running,
    Crashed { message: &'a str },
    Closed,
}

#[derive(Debug, Serialize)]
pub(crate) struct RunDesc<'a> {
    pub id: RunId,
    pub title: &'a str,
    pub output_cells: &'a [OutputCell],
    pub kernel_state: KernelStateDesc<'a>,
    pub globals: &'a Globals,
}

#[derive(Debug, Serialize)]
pub(crate) struct NotebookDesc<'a> {
    pub id: NotebookId,
    pub path: &'a str,
    pub editor_cells: &'a [EditorCell],
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
#[serde(tag = "type")]
pub(crate) enum ToClientMessage<'a> {
    Error {
        message: &'a str,
    },
    NewNotebook {
        notebook: NotebookDesc<'a>,
    },
    // NewRun {
    //     notebook_id: NotebookId,
    //     run_id: RunId,
    // },
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
        globals: Option<&'a GlobalsUpdate>,
    },
    SaveCompleted {
        notebook_id: NotebookId,
        error: Option<String>,
    },
    DirList {
        entries: &'a [DirEntry],
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
