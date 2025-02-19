import { EditorCell, OutputCellState, RunId } from "./notebook";
import { State } from "./state";
import { Dispatch } from "react";
import { StateAction } from "./state";
import { SendCommand } from "./messages";
import { v4 as uuidv4 } from "uuid";

export function newRun(
  state: State,
  dispatch: Dispatch<StateAction>,
  send_command: SendCommand,
): RunId {
  const run_title = `Run ${state.notebook!.runs.length + 1}`;
  const run_id = uuidv4();
  dispatch({
    type: "fresh_run",
    run_id: run_id,
    run_title: run_title,
  });
  send_command({
    type: "CreateNewKernel",
    notebook_id: state.notebook!.id,
    run_id: run_id,
    run_title: run_title,
  });
  return run_id;
}

export function runCell(
  cell: EditorCell,
  state: State,
  dispatch: Dispatch<StateAction>,
  send_command: SendCommand,
) {
  let run_id = state.current_run_id;
  let status: OutputCellState = "pending";
  if (run_id == null) {
    run_id = newRun(state, dispatch, send_command);
  } else {
    let run = state.notebook!.runs.find((r) => r.id == run_id)!;
    if (
      run.kernel_state == "ready" &&
      run.output_cells.find((c) => c.status == "running") == null
    ) {
      status = "running";
    }
  }
  let cell_id = uuidv4();
  dispatch({
    type: "new_output_cell",
    cell: {
      id: cell_id,
      values: [],
      status,
      editor_cell: cell,
    },
    run_id: run_id,
  });
  send_command({
    type: "RunCell",
    run_id: run_id,
    cell_id: cell_id,
    editor_cell: cell,
  });
}

export function newEdtorCell(dispatch: Dispatch<StateAction>) {
  const cell_id = uuidv4();
  dispatch({
    type: "new_editor_cell",
    editor_cell: {
      id: cell_id,
      value: "",
    },
  });
  // TODO send to serer
}
