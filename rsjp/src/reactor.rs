use crate::client_messages::{RunCellMsg, ToClientMessage};
use crate::kernel::spawn_kernel;
use crate::notebook::{NotebookId, OutputCellId, Run, RunId};
use crate::state::{AppState, AppStateRef};
use anyhow::bail;
use comm::messages::{ComputeMsg, FromKernelMessage, ToKernelMessage};

pub fn start_kernel(
    state: &mut AppState,
    state_ref: &AppStateRef,
    notebook_id: NotebookId,
    run_id: RunId,
    run_title: String,
) -> anyhow::Result<()> {
    let kernel_port = state.kernel_port();
    let notebook = state.find_notebook_by_id_mut(notebook_id)?;
    let kernel = spawn_kernel(state_ref, run_id, kernel_port)?;
    notebook.add_run(run_id);
    let run = Run::new(notebook_id, run_title, Some(kernel));
    state.add_run(run_id, run);
    Ok(())
}

pub fn run_code(state: &mut AppState, msg: RunCellMsg) -> anyhow::Result<()> {
    let run = state.find_run_by_id_mut(msg.run_id)?;
    if let Some(kernel) = run.kernel_mut() {
        kernel.send_message(ToKernelMessage::Compute(ComputeMsg {
            cell_id: msg.cell_id.as_uuid(),
            code: msg.editor_cell.value,
        }))
    }
    Ok(())
}

pub fn process_kernel_message(
    state: &mut AppState,
    run_id: RunId,
    msg: FromKernelMessage,
) -> anyhow::Result<()> {
    match msg {
        FromKernelMessage::Login { .. } => bail!("Process is already logged"),
        FromKernelMessage::Output {
            value,
            cell_id,
            flag,
        } => {
            let notebook_id = if let Some(run) = state.get_run_by_id(run_id) {
                run.notebook_id()
            } else {
                return Ok(());
            };
            state
                .notebook_by_id(notebook_id)
                .send_message(ToClientMessage::Output {
                    run_id,
                    cell_id: OutputCellId::from(cell_id),
                    value,
                    flag,
                });
        }
    }
    Ok(())
}
