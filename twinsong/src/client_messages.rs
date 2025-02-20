use crate::notebook::{EditorCell, NotebookId, OutputCellId, RunId};
use axum::extract::ws::Message;
use comm::messages::{OutputFlag, OutputValue};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum FromClientMessage {
    CreateNewNotebook(CreateNewNotebookMsg),
    CreateNewKernel(CreateNewKernelMsg),
    RunCell(RunCellMsg),
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
    pub run_id: RunId,
    pub cell_id: OutputCellId,
    pub editor_cell: EditorCell,
}

#[derive(Debug, Serialize)]
pub(crate) struct NotebookDesc<'a> {
    pub id: NotebookId,
    pub title: &'a str,
    pub editor_cells: &'a [EditorCell],
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
        run_id: RunId,
    },
    KernelCrashed {
        run_id: RunId,
        message: String,
    },
    Output {
        run_id: RunId,
        cell_id: OutputCellId,
        value: OutputValue,
        flag: OutputFlag,
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
