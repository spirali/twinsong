import { Dispatch } from "react";
import {
  CellId,
  EditorCell,
  Notebook,
  NotebookId,
  OutputCellState,
  OutputValue,
  RunId,
} from "./notebook";
import { StateAction } from "./state";

export type SendCommand = (message: FromClientMessage) => void;

interface NewNotebookMsg {
  type: "NewNotebook";
  notebook: Notebook;
}

interface KernelReadyMsg {
  type: "KernelReady";
  notebook_id: NotebookId;
  run_id: RunId;
}

interface KernelCrashedMsg {
  type: "KernelCrashed";
  notebook_id: NotebookId;
  run_id: RunId;
  message: string;
}

interface OutputMsg {
  type: "Output";
  notebook_id: NotebookId;
  run_id: RunId;
  cell_id: CellId;
  flag: "Success" | "Fail" | "Stream";
  value: OutputValue;
}

interface SaveCompletedMsg {
  type: "SaveCompleted";
  notebook_id: NotebookId;
  error: string | null;
}

export type ToClientMessage =
  | NewNotebookMsg
  | KernelReadyMsg
  | KernelCrashedMsg
  | OutputMsg
  | SaveCompletedMsg;

interface CreateNewNotebookMsg {
  type: "CreateNewNotebook";
}

interface CreateNewKernelMsg {
  type: "CreateNewKernel";
  notebook_id: NotebookId;
  run_title: string;
  run_id: string;
}

interface SaveNotebookMsg {
  type: "SaveNotebook";
  notebook_id: NotebookId;
  editor_cells: EditorCell[];
}

interface RunCellMsg {
  type: "RunCell";
  notebook_id: NotebookId;
  run_id: RunId;
  cell_id: CellId;
  editor_cell: EditorCell;
}

export type FromClientMessage =
  | CreateNewNotebookMsg
  | CreateNewKernelMsg
  | RunCellMsg
  | SaveNotebookMsg;

export function processMessage(
  message: ToClientMessage,
  dispatch: Dispatch<StateAction>,
) {
  switch (message.type) {
    case "NewNotebook": {
      dispatch({
        type: "add_notebook",
        notebook: message.notebook,
      });
      break;
    }
    case "KernelReady": {
      dispatch({
        type: "kernel_changed",
        notebook_id: message.notebook_id,
        run_id: message.run_id,
        kernel_state: "ready",
        message: null,
      });
      break;
    }
    case "KernelCrashed": {
      dispatch({
        type: "kernel_changed",
        notebook_id: message.notebook_id,
        run_id: message.run_id,
        kernel_state: "crashed",
        message: message.message,
      });
      break;
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
        notebook_id: message.notebook_id,
        run_id: message.run_id,
        cell_id: message.cell_id,
        status,
        value: message.value,
      });
      break;
    }
    case "SaveCompleted": {
      dispatch({
        type: "save_notebook",
        notebook_id: message.notebook_id,
        save_in_progress: false,
      });
      break;
    }
  }
}
