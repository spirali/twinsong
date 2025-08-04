import { Dispatch } from "react";
import {
  EditorGroupNode as EditorGroup,
  EditorNode,
  EditorNodeId,
  KernelState,
  NotebookDesc,
  NotebookId,
  OutputCellFlag,
  OutputValue,
  RunId,
} from "./notebook";
import { DirEntry, StateAction } from "./state";
import { NotificationType } from "../components/NotificationProvider";

export type SendCommand = (message: FromClientMessage) => void;

interface NewNotebookMsg {
  type: "NewNotebook";
  notebook: NotebookDesc;
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

export interface SerializedGlobalsUpdate {
  variables: { string: string | null };
  name: string;
  children: { string: SerializedGlobalsUpdate };
}

export interface SerializedGlobals {
  variables: { string: string };
  name: string;
  children: { string: SerializedGlobalsUpdate };
}

interface OutputMsg {
  type: "Output";
  notebook_id: NotebookId;
  run_id: RunId;
  cell_id: EditorNodeId;
  flag: OutputCellFlag;
  value: OutputValue;
  update: null | SerializedGlobalsUpdate;
  kernel_state: KernelState;
}

interface NewGlobalsMsg {
  type: "NewGlobals";
  notebook_id: NotebookId;
  run_id: RunId;
  globals: SerializedGlobals;
}

interface SaveCompletedMsg {
  type: "SaveCompleted";
  notebook_id: NotebookId;
  error: string | null;
}

interface DirList {
  type: "DirList";
  entries: DirEntry[];
}

interface Error {
  type: "Error";
  message: string;
}

export type ToClientMessage =
  | Error
  | NewNotebookMsg
  | KernelReadyMsg
  | KernelCrashedMsg
  | OutputMsg
  | NewGlobalsMsg
  | SaveCompletedMsg
  | DirList;

interface CreateNewNotebookMsg {
  type: "CreateNewNotebook";
  filename: string;
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
  editor_root: EditorGroup;
}

interface RunCodeMsg {
  type: "RunCode";
  notebook_id: NotebookId;
  run_id: RunId;
  cell_id: EditorNodeId;
  editor_node: EditorNode;
  called_id: EditorNodeId;
}

interface LoadNotebookMsg {
  type: "LoadNotebook";
  path: string;
}

interface CloseRunMsg {
  type: "CloseRun";
  notebook_id: NotebookId;
  run_id: RunId;
}

interface ForkRunMsg {
  type: "Fork";
  notebook_id: NotebookId;
  run_id: RunId;
  new_run_id: RunId;
  new_run_title: string;
}

export type FromClientMessage =
  | CreateNewNotebookMsg
  | CreateNewKernelMsg
  | RunCodeMsg
  | CloseRunMsg
  | ForkRunMsg
  | LoadNotebookMsg
  | SaveNotebookMsg;

export function processMessage(
  message: ToClientMessage,
  dispatch: Dispatch<StateAction>,
  pushNotification: (text: string, type: NotificationType) => void,
) {
  switch (message.type) {
    case "NewNotebook": {
      /// Because the root node is alwas EditorNamedNode
      /// so server does not send type
      /// But JS bad system of enums force us to fill the type
      message.notebook.editor_root.type = "Group";
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
        kernel_state: { type: "Ready" },
      });
      break;
    }
    case "KernelCrashed": {
      dispatch({
        type: "kernel_changed",
        notebook_id: message.notebook_id,
        run_id: message.run_id,
        kernel_state: { type: "Crashed", message: message.message },
      });
      break;
    }
    case "Output": {
      dispatch({
        type: "new_output",
        notebook_id: message.notebook_id,
        run_id: message.run_id,
        cell_id: message.cell_id,
        flag: message.flag,
        value: message.value,
        update: message.update,
        kernel_state: message.kernel_state,
      });
      break;
    }
    case "NewGlobals": {
      dispatch({
        type: "new_globals",
        notebook_id: message.notebook_id,
        run_id: message.run_id,
        globals: message.globals,
      });
      break;
    }
    case "SaveCompleted": {
      dispatch({
        type: "save_notebook",
        notebook_id: message.notebook_id,
        save_in_progress: false,
      });
      if (message.error) {
        pushNotification(message.error, "error");
      } else {
        pushNotification("Notebook saved", "success");
      }
      break;
    }
    case "DirList": {
      dispatch({
        type: "set_dir_entries",
        entries: message.entries,
      });
      break;
    }
    case "Error": {
      pushNotification(message.message, "error");
      break;
    }
    default: {
      console.log("Unknown message", message);
    }
  }
}
