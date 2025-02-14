import { Dispatch } from "react";
import { CellId, EditorCell, Notebook, NotebookId, OutputCellState, OutputFlag, OutputValue, Run, RunId } from "./notebook";
import { StateAction } from "./state";

export type SendCommand = (message: FromClientMessage) => void;

interface NewNotebookMsg {
    type: "NewNotebook",
    notebook: Notebook,
}

interface KernelReadyMsg {
    type: "KernelReady",
    run_id: RunId,
}

interface KernelCrashedMsg {
    type: "KernelCrashed",
    run_id: RunId,
    message: string,
}


interface OutputMsg {
    type: "Output",
    run_id: RunId,
    cell_id: CellId,
    flag: "Success" | "Fail",
    value: OutputValue,
}


export type ToClientMessage = NewNotebookMsg | KernelReadyMsg | KernelCrashedMsg | OutputMsg;


interface CreateNewNotebookMsg {
    type: "CreateNewNotebook",
}

interface CreateNewKernelMsg {
    type: "CreateNewKernel",
    notebook_id: NotebookId,
    run_title: string,
    run_id: string,
}

interface RunCellMsg {
    type: "RunCell",
    run_id: RunId,
    cell_id: CellId,
    editor_cell: EditorCell,
}

export type FromClientMessage = CreateNewNotebookMsg | CreateNewKernelMsg | RunCellMsg;


export function processMessage(message: ToClientMessage, dispatch: Dispatch<StateAction>) {
    switch (message.type) {
        case "NewNotebook": {
            dispatch({
                type: "set_notebook",
                notebook: message.notebook
            })
            break;
        }
        case "KernelReady": {
            dispatch({
                type: "kernel_changed",
                run_id: message.run_id,
                kernel_state: "ready",
                message: null,
            })
            break
        }
        case "KernelCrashed": {
            dispatch({
                type: "kernel_changed",
                run_id: message.run_id,
                kernel_state: "crashed",
                message: message.message,
            })
            break
        }
        case "Output": {
            let status: OutputCellState;
            if (message.flag == "Success") {
                status = "success";
            } else if (message.flag == "Fail") {
                status = "error";
            } else {
                status = "running";
            }
            dispatch({
                type: "new_output",
                run_id: message.run_id,
                cell_id: message.cell_id,
                status,
                value: message.value,
            })
            break
        }
    }
}  