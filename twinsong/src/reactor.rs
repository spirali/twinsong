use crate::client_messages::{
    DirEntry, DirEntryType, LoadNotebookMsg, RunCodeMsg, SaveNotebookMsg, ToClientMessage,
    serialize_client_message,
};
use crate::kernel::{KernelCtx, spawn_kernel};
use crate::notebook::{
    KernelId, KernelState, Notebook, NotebookId, OutputCell, OutputCellId, OutputValue, Run, RunId,
    generate_new_notebook_path,
};
use crate::state::{AppState, AppStateRef};
use crate::storage::{SerializedNotebook, deserialize_notebook, serialize_notebook};
use anyhow::bail;
use axum::extract::ws::Message;
use comm::messages::{ComputeMsg, FromKernelMessage, ToKernelMessage};
use comm::scopes::SerializedGlobals;
use jiff::Timestamp;
use std::path::Path;
use tokio::spawn;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

pub(crate) fn new_notebook(
    state: &mut AppState,
    state_ref: &AppStateRef,
    sender: UnboundedSender<Message>,
) -> anyhow::Result<()> {
    let notebook_id = state.new_notebook_id();
    tracing::debug!("Creating new notebook {notebook_id}");
    let mut notebook = Notebook::new(generate_new_notebook_path()?);
    notebook.set_observer(sender.clone());
    notebook.send_message(ToClientMessage::NewNotebook {
        notebook: notebook.notebook_desc(notebook_id),
    });
    state.add_notebook(notebook_id, notebook);
    let notebook = state.get_notebook_by_id(notebook_id).unwrap();
    save_helper(notebook_id, notebook, state_ref, true)
}

pub(crate) fn start_kernel(
    state: &mut AppState,
    state_ref: &AppStateRef,
    notebook_id: NotebookId,
    run_id: RunId,
    run_title: String,
) -> anyhow::Result<()> {
    let kernel_port = state.kernel_port();
    let notebook = state.find_notebook_by_id_mut(notebook_id)?;
    let kernel_id = KernelId::new(Uuid::new_v4());
    let kernel_ctx = KernelCtx {
        kernel_id,
        notebook_id,
        run_id,
    };
    let run = Run::new(
        run_title,
        Vec::new(),
        KernelState::Init(kernel_ctx.kernel_id),
        SerializedGlobals::default(),
        Timestamp::now(),
    );
    notebook.add_run(run_id, run);
    match spawn_kernel(state_ref, kernel_ctx, kernel_port) {
        Ok(kernel) => {
            state.add_kernel(kernel_id, kernel);
        }
        Err(e) => {
            tracing::error!("Starting kernel failed {e}");
            let run = notebook.find_run_by_id_mut(run_id).unwrap();
            run.set_crashed_kernel(e.to_string());
            notebook.send_message(ToClientMessage::KernelCrashed {
                notebook_id,
                run_id,
                message: e.to_string(),
            });
        }
    }
    Ok(())
}

pub(crate) fn run_code(state: &mut AppState, msg: RunCodeMsg) -> anyhow::Result<()> {
    tracing::debug!("Runnning code {:?}", msg);
    let notebook = state.find_notebook_by_id_mut(msg.notebook_id)?;
    let run = notebook.find_run_by_id_mut(msg.run_id)?;
    let code = msg.editor_node.to_code_group();
    run.add_output_cell(OutputCell::new(msg.cell_id, msg.editor_node));
    run.queue_increment();
    if let Some(kernel) = run
        .kernel_id()
        .and_then(|kernel_id| state.get_kernel_by_id_mut(kernel_id))
    {
        kernel.send_message(ToKernelMessage::Compute(ComputeMsg {
            cell_id: msg.cell_id.into_inner(),
            code,
        }))
    }
    Ok(())
}

pub(crate) fn process_kernel_message(
    state: &mut AppState,
    kernel_ctx: &KernelCtx,
    msg: FromKernelMessage,
) -> anyhow::Result<()> {
    match msg {
        FromKernelMessage::Login { .. } => bail!("Process is already logged"),
        FromKernelMessage::Output {
            value,
            cell_id,
            flag,
            update,
        } => {
            let value = OutputValue::new(value);
            let notebook = state.find_notebook_by_id_mut(kernel_ctx.notebook_id)?;
            let run = notebook.find_run_by_id_mut(kernel_ctx.run_id)?;
            if flag.is_final() {
                run.queue_decrement();
            }
            let kernel_state = run.kernel_state_desc();
            notebook.send_message(ToClientMessage::Output {
                notebook_id: kernel_ctx.notebook_id,
                run_id: kernel_ctx.run_id,
                cell_id: OutputCellId::new(cell_id),
                value: &value,
                flag,
                update: update.as_ref(),
                kernel_state,
            });
            // TODO: Remove double lookup, this is just because of lifetime problems
            let run = notebook.find_run_by_id_mut(kernel_ctx.run_id)?;
            if let Some(update) = update {
                run.update_globals(update)
            }
            run.add_output(OutputCellId::new(cell_id), value, flag);
        }
    }
    Ok(())
}

fn save_helper(
    notebook_id: NotebookId,
    notebook: &Notebook,
    state_ref: &AppStateRef,
    new_notebook: bool,
) -> anyhow::Result<()> {
    let path = Path::new(&notebook.path).to_path_buf();
    tracing::debug!("Saving notebook as {}", path.display());
    let serialized_notebook = serialize_notebook(notebook)?;
    let state_ref = state_ref.clone();
    spawn(async move {
        let error = serialized_notebook
            .save(&path)
            .await
            .err()
            .map(|e| e.to_string());
        if let Some(err) = &error {
            tracing::debug!("Saving notebook as {} failed: {}", path.display(), err);
        } else {
            tracing::debug!("Saving notebook as {} finished", path.display());
        }
        let mut state = state_ref.lock().unwrap();
        if !new_notebook {
            if let Some(notebook) = state.get_notebook_by_id(notebook_id) {
                notebook.send_message(ToClientMessage::SaveCompleted { notebook_id, error });
            }
        } else if let Ok(message) = query_helper(&mut state) {
            if let Some(notebook) = state.get_notebook_by_id(notebook_id) {
                notebook.send_raw_message(message)
            }
        }
    });
    Ok(())
}

pub(crate) fn save_notebook(
    state: &mut AppState,
    state_ref: &AppStateRef,
    msg: SaveNotebookMsg,
) -> anyhow::Result<()> {
    let notebook_id = msg.notebook_id;
    let notebook = state.find_notebook_by_id_mut(notebook_id)?;
    notebook.editor_root = msg.editor_root;
    save_helper(notebook_id, notebook, state_ref, false)
}

pub(crate) fn load_notebook(
    state: &mut AppState,
    state_ref: &AppStateRef,
    msg: LoadNotebookMsg,
    sender: UnboundedSender<Message>,
) -> anyhow::Result<()> {
    let path = msg.path;
    tracing::debug!("Loading notebook {}", path);
    if let Some((notebook_id, notebook)) = state.get_notebook_by_path_mut(&path) {
        tracing::debug!("Notebook is already loaded");
        notebook.set_observer(sender);
        notebook.send_message(ToClientMessage::NewNotebook {
            notebook: notebook.notebook_desc(notebook_id),
        });
        return Ok(());
    }
    let state_ref = state_ref.clone();
    spawn(async move {
        match SerializedNotebook::load(Path::new(&path))
            .await
            .and_then(|s| deserialize_notebook(&s))
        {
            Err(e) => {
                let _ = sender.send(
                    serialize_client_message(ToClientMessage::Error {
                        message: &format!("Failed to load notebook: {e}"),
                    })
                    .unwrap(),
                );
            }
            Ok(mut notebook) => {
                // TODO: Fix parallel loads
                notebook.set_observer(sender);
                notebook.path = path;
                let mut state = state_ref.lock().unwrap();
                let notebook_id = state.new_notebook_id();
                notebook.send_message(ToClientMessage::NewNotebook {
                    notebook: notebook.notebook_desc(notebook_id),
                });
                state.add_notebook(notebook_id, notebook);
            }
        }
    });
    Ok(())
}

fn query_helper(state: &mut AppState) -> anyhow::Result<Message> {
    let mut entries: Vec<DirEntry> = std::fs::read_dir(Path::new("."))?
        .filter_map(|r| r.ok())
        .filter_map(|entry| {
            let path = entry.path().file_name().unwrap().to_str()?.to_string();
            let file_type = entry.file_type().ok()?;
            let entry_type = if file_type.is_file() && path.ends_with(".tsnb") {
                if state.get_notebook_by_path_mut(&path).is_some() {
                    DirEntryType::LoadedNotebook
                } else {
                    DirEntryType::Notebook
                }
            } else if file_type.is_dir() {
                if path.ends_with(".tsnb.runs") {
                    return None;
                }
                DirEntryType::Dir
            } else {
                DirEntryType::File
            };
            Some(DirEntry { path, entry_type })
        })
        .collect();
    entries.sort_unstable_by(|a, b| a.path.cmp(&b.path));
    serialize_client_message(ToClientMessage::DirList { entries: &entries })
}

pub(crate) fn query_dir(
    state: &mut AppState,
    sender: &UnboundedSender<Message>,
) -> anyhow::Result<()> {
    let message = query_helper(state)?;
    let _ = sender.send(message);
    Ok(())
}

pub(crate) fn close_run(
    state: &mut AppState,
    notebook_id: NotebookId,
    run_id: RunId,
) -> anyhow::Result<()> {
    tracing::debug!("Closing run {}", run_id);
    let notebook = state.find_notebook_by_id_mut(notebook_id)?;
    let run = notebook.remove_run_by_id(run_id)?;
    match run.kernel_state() {
        KernelState::Init(kernel_id) | KernelState::Running(kernel_id) => {
            let kernel_id = *kernel_id;
            state.stop_kernel(kernel_id);
        }
        KernelState::Crashed(_) | KernelState::Closed => { /* Do nothing */ }
    }
    Ok(())
}
