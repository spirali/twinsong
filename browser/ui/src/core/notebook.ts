import { JsonObjectStruct } from "./jobject";

export type RunId = string;
export type NotebookId = number;
export type CellId = string;

export type KernelState =
  | { type: "Crashed", message: string }
  | { type: "Init" }
  | { type: "Running" }
  | { type: "Closed" };

export type OutputCellFlag = "Pending" | "Running" | "Success" | "Fail";

export interface EditorCell {
  id: CellId;
  value: string;
}

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
  id: CellId;
  values: OutputValue[];
  flag: OutputCellFlag;
  editor_cell: EditorCell;
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
  editor_cells: EditorCell[];
  runs: Run[];
  waiting_for_fresh: EditorCell[];
  current_run_id: RunId | null;
  selected_editor_cell_id: CellId | null;
  save_in_progress: boolean;
}

export interface NotebookDesc {
  id: NotebookId;
  editor_cells: EditorCell[];
  runs: RunDesc[];
  path: string;
}

export interface RunDesc {
  id: RunId;
  title: string;
  kernel_state: KernelState;
  output_cells: OutputCell[];
  globals: [string, JsonObjectStruct][];
}
