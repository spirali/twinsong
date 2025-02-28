import { EditorCell, Notebook, OutputCellFlag, RunId } from "./notebook";
import { State } from "./state";
import { Dispatch } from "react";
import { StateAction } from "./state";
import { SendCommand } from "./messages";
import { v4 as uuidv4 } from "uuid";
import { PushNotification } from "../components/NotificationProvider";

export function newRun(
  notebook: Notebook,
  dispatch: Dispatch<StateAction>,
  send_command: SendCommand,
): RunId {
  const run_title = `Run ${notebook.runs.length + 1}`;
  const run_id = uuidv4();
  dispatch({
    type: "fresh_run",
    notebook_id: notebook.id,
    run_id: run_id,
    run_title: run_title,
  });
  send_command({
    type: "CreateNewKernel",
    notebook_id: notebook.id,
    run_id: run_id,
    run_title: run_title,
  });
  return run_id;
}

export function runCell(
  cell: EditorCell,
  notebook: Notebook,
  dispatch: Dispatch<StateAction>,
  send_command: SendCommand,
  pushNotification: PushNotification,
) {
  let run_id = notebook.current_run_id;
  let flag: OutputCellFlag = "Pending";
  if (run_id === null) {
    run_id = newRun(notebook, dispatch, send_command);
  } else {
    let run = notebook.runs.find((r) => r.id === run_id)!;
    if (run.kernel_state.type === "Crashed" || run.kernel_state.type === "Closed") {
      pushNotification("Kernel for this run is inactive. Start new one.", "error")
      return
    }
    if (
      run.kernel_state.type === "Running" &&
      run.output_cells.find((c) => c.flag === "Running") == null
    ) {
      flag = "Running";
    }
  }
  let cell_id = uuidv4();
  dispatch({
    type: "new_output_cell",
    notebook_id: notebook.id,
    cell: {
      id: cell_id,
      values: [],
      flag,
      editor_cell: cell,
    },
    run_id: run_id,
  });
  send_command({
    type: "RunCell",
    notebook_id: notebook.id,
    run_id: run_id,
    cell_id: cell_id,
    editor_cell: cell,
  });
}

export function newEdtorCell(
  notebook: Notebook,
  dispatch: Dispatch<StateAction>,
) {
  const cell_id = uuidv4();
  dispatch({
    type: "new_editor_cell",
    notebook_id: notebook.id,
    editor_cell: {
      id: cell_id,
      value: "",
    },
  });
}

export function saveNotebook(
  notebook: Notebook,
  dispatch: Dispatch<StateAction>,
  send_command: SendCommand,
) {
  send_command({
    type: "SaveNotebook",
    notebook_id: notebook.id,
    editor_cells: notebook.editor_cells,
  });
  dispatch({
    type: "save_notebook",
    notebook_id: notebook.id,
    save_in_progress: true,
  });
}

export function loadNotebook(
  state: State,
  path: string,
  dispatch: Dispatch<StateAction>,
  send_command: SendCommand,
) {
  const notebook = state.notebooks.find((n) => n.path === path);
  if (notebook) {
    dispatch({
      type: "set_selected_notebook",
      id: notebook.id,
    });
  } else {
    send_command({
      type: "LoadNotebook",
      path,
    });
  }
}
