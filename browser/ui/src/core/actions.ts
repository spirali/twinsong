import { EditorCell, RunId } from "./notebook";
import { State } from "./state";
import { Dispatch } from "react";
import { StateAction } from "./state";
import { SendCommand } from "./messages";
import { v4 as uuidv4 } from 'uuid';

export function new_run(state: State, dispatch: Dispatch<StateAction>, send_command: SendCommand): RunId {
    const run_title = `Run ${state.notebook!.runs.length + 1}`;
    const run_id = uuidv4();
    dispatch({
        type: "fresh_run",
        run_id: run_id,
        run_title: run_title,
    })
    send_command({
        type: "CreateNewKernel",
        notebook_id: state.notebook!.id,
        run_id: run_id,
        run_title: run_title,
    })
    return run_id;
}

export function run_cell(cell: EditorCell, state: State, dispatch: Dispatch<StateAction>, send_command: SendCommand) {
    let run_id = state.current_run_id;
    if (run_id == null) {
        run_id = new_run(state, dispatch, send_command)
    }
    let cell_id = uuidv4();
    dispatch({
        type: "new_output_cell",
        cell: {
            id: cell_id,
            values: [],
            status: "pending",
            editor_cell: cell,
        },
        run_id: run_id,
    })
    send_command({
        type: "RunCell",
        run_id: run_id,
        cell_id: cell_id,
        editor_cell: cell,
    })
}