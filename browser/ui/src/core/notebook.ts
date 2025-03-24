import { JsonObjectStruct } from "./jobject";
import { SerializedGlobals } from "./messages";

export type RunId = string;
export type NotebookId = number;
export type EditorNodeId = string;

export type KernelState =
  | { type: "Crashed"; message: string }
  | { type: "Init" }
  | { type: "Ready" }
  | { type: "Running" }
  | { type: "Closed" };

export type OutputCellFlag = "Pending" | "Running" | "Success" | "Fail";

export interface EditorCell {
  type: "Cell";
  id: EditorNodeId;
  code: string;
}

export enum EditorScope {
  Own = "Own",
  Inherit = "Inherit",
}

export interface EditorGroupNode {
  type: "Group";
  id: EditorNodeId;
  name: string;
  children: EditorNode[];
  scope: EditorScope;
}

export type EditorNode = EditorGroupNode | EditorCell;

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
  called_id: EditorNodeId;
}

export type RunViewMode = "outputs" | "workspace";

export interface Globals {
  variables: [string, JsonObjectStruct][];
  name: string;
  children: [string, Globals][];
}

export interface Run {
  id: RunId;
  title: string;
  kernel_state: KernelState;
  output_cells: OutputCell[];
  view_mode: RunViewMode;
  globals: Globals;
  open_objects: Set<string>;
}

export interface Notebook {
  id: NotebookId;
  path: string;
  editor_root: EditorGroupNode;
  editor_open_nodes: Set<string>;
  runs: Run[];
  waiting_for_fresh: EditorCell[];
  current_run_id: RunId | null;
  selected_editor_node_id: EditorNodeId | null;
  save_in_progress: boolean;
}

export interface NotebookDesc {
  id: NotebookId;
  editor_root: EditorGroupNode;
  editor_open_nodes: string[];
  runs: RunDesc[];
  path: string;
}

export interface RunDesc {
  id: RunId;
  title: string;
  kernel_state: KernelState;
  output_cells: OutputCell[];
  globals: SerializedGlobals;
}
