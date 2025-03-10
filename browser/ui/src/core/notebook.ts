import { JsonObjectStruct } from "./jobject";

export type RunId = string;
export type NotebookId = number;
export type EditorNodeId = string;

export type KernelState =
  | { type: "Crashed"; message: string }
  | { type: "Init" }
  | { type: "Running" }
  | { type: "Closed" };

export type OutputCellFlag = "Pending" | "Running" | "Success" | "Fail";

export interface EditorCell {
  type: "Cell";
  id: EditorNodeId;
  value: string;
}

export interface EditorNamedNode {
  type: "Node";
  id: EditorNodeId;
  name: string;
  children: EditorNode[];
  open?: boolean;
}

export type EditorNode = EditorNamedNode | EditorCell;

export interface TextOutputValue {
  type: "Text";
  value: string;
}

export interface HtmlOutputValue {
  type: "Html";
  value: string;
}

export interface ExceptionOutputValue {
  type: "Exception";
  value: {
    message: string;
    traceback: string;
  };
}

export type OutputValue =
  | TextOutputValue
  | HtmlOutputValue
  | ExceptionOutputValue
  | { type: "None" };

export interface OutputCell {
  id: EditorNodeId;
  values: OutputValue[];
  flag: OutputCellFlag;
  editor_node: EditorNode;
}

export type RunViewMode = "outputs" | "workspace";

export interface Run {
  id: RunId;
  title: string;
  kernel_state: KernelState;
  output_cells: OutputCell[];
  view_mode: RunViewMode;
  globals: [string, JsonObjectStruct][];
  open_objects: Set<string>;
}

export interface Notebook {
  id: NotebookId;
  path: string;
  editor_root: EditorNamedNode;
  runs: Run[];
  waiting_for_fresh: EditorCell[];
  current_run_id: RunId | null;
  selected_editor_node_id: EditorNodeId | null;
  save_in_progress: boolean;
}

export interface NotebookDesc {
  id: NotebookId;
  editor_root: EditorNamedNode;
  runs: RunDesc[];
  path: string;
}

export interface RunDesc {
  id: RunId;
  title: string;
  kernel_state: KernelState;
  output_cells: OutputCell[];
  globals: [string, string][];
}
