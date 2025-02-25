use crate::client_messages::{
    serialize_client_message, LoadNotebookMsg, NotebookDesc, NotebookInfo, RunCellMsg,
    SaveNotebookMsg, ToClientMessage,
};
use crate::kernel::{spawn_kernel, KernelCtx};
use crate::notebook::{KernelId, Notebook, NotebookId, OutputCellId, OutputValue, Run, RunId};
use crate::state::{AppState, AppStateRef};
use crate::storage::{deserialize_notebook, serialize_notebook};
use anyhow::bail;
use axum::extract::ws::Message;
use comm::messages::{ComputeMsg, FromKernelMessage, ToKernelMessage};
use std::path::{Path, PathBuf};
use tokio::spawn;
use tokio::sync::mpsc::UnboundedSender;
use tokio::task::spawn_local;
use uuid::Uuid;

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
    let run = Run::new(run_title, Vec::new(), Some(kernel_ctx.kernel_id));
    let kernel = spawn_kernel(state_ref, kernel_ctx, kernel_port)?;
    notebook.add_run(run_id, run);
    state.add_kernel(kernel_id, kernel);
    Ok(())
}

pub(crate) fn run_code(state: &mut AppState, msg: RunCellMsg) -> anyhow::Result<()> {
    let notebook = state.find_notebook_by_id_mut(msg.notebook_id)?;
    let run = notebook.find_run_by_id_mut(msg.run_id)?;
    if let Some(kernel) = run
        .kernel_id()
        .and_then(|kernel_id| state.get_kernel_by_id_mut(kernel_id))
    {
        kernel.send_message(ToKernelMessage::Compute(ComputeMsg {
            cell_id: msg.cell_id.into_inner(),
            code: msg.editor_cell.value,
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
        } => {
            let value = OutputValue::new(value);
            let notebook = state.find_notebook_by_id_mut(kernel_ctx.notebook_id)?;
            notebook.send_message(ToClientMessage::Output {
                notebook_id: kernel_ctx.notebook_id,
                run_id: kernel_ctx.run_id,
                cell_id: OutputCellId::new(cell_id),
                value: &value,
                flag,
            });
            let run = notebook.find_run_by_id_mut(kernel_ctx.run_id)?;
            run.add_output(OutputCellId::new(cell_id), value, flag);
        }
    }
    Ok(())
}

pub(crate) fn save_notebook(
    state: &mut AppState,
    state_ref: &AppStateRef,
    msg: SaveNotebookMsg,
) -> anyhow::Result<()> {
    let notebook_id = msg.notebook_id;
    let notebook = state.find_notebook_by_id_mut(notebook_id)?;
    let path = Path::new(&format!("{}.tsnb", notebook.path)).to_path_buf();
    notebook.editor_cells = msg.editor_cells;
    let data = serialize_notebook(notebook)?;
    let state_ref = state_ref.clone();
    tracing::debug!("Saving notebook as {}", path.display());
    spawn(async move {
        let error = tokio::fs::write(&path, data)
            .await
            .err()
            .map(|e| e.to_string());
        if let Some(err) = &error {
            tracing::debug!("Saving notebook as {} failed: {}", path.display(), err);
        } else {
            tracing::debug!("Saving notebook as {} finished", path.display());
        }
        let state = state_ref.lock().unwrap();
        state.get_notebook_by_id(notebook_id).map(|notebook| {
            notebook.send_message(ToClientMessage::SaveCompleted { notebook_id, error });
        });
    });
    Ok(())
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
        match tokio::fs::read_to_string(Path::new(&format!("{path}.tsnb")))
            .await
            .map_err(|err| err.into())
            .and_then(|s| deserialize_notebook(s.as_str()))
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

pub(crate) fn query_notebooks(
    state: &mut AppState,
    sender: &UnboundedSender<Message>,
) -> anyhow::Result<()> {
    let mut infos: Vec<NotebookInfo> = std::fs::read_dir(Path::new("."))?
        .filter_map(|r| r.ok())
        .filter_map(|entry| {
            dbg!(entry.path());
            if entry.file_type().ok()?.is_file() {
                let path = entry
                    .path()
                    .file_name()
                    .unwrap()
                    .to_str()?
                    .strip_suffix(".tsnb")?
                    .to_string();
                let is_loaded = state.get_notebook_by_path_mut(&path).is_some();
                Some(NotebookInfo { path, is_loaded })
            } else {
                None
            }
        })
        .collect();
    infos.sort_unstable_by(|a, b| a.path.cmp(&b.path));
    let _ = sender.send(serialize_client_message(ToClientMessage::NotebookList {
        notebooks: &infos,
    })?);
    Ok(())
}
