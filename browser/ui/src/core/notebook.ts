export type RunId = string;
export type NotebookId = number;
export type CellId = string;

export type KernelState = "init" | "ready" | "running" | "closed" | "crashed";
export type OutputCellState = "pending" | "running" | "success" | "error";

export interface EditorCell {
  id: CellId;
  value: string;
}

export interface TextOutputValue {
  Text: { value: string };
}

export interface HtmlOutputValue {
  Html: { value: string };
}

export interface ExceptionOutputValue {
  Exception: { message: string; traceback: string };
}

export type OutputValue =
  | TextOutputValue
  | HtmlOutputValue
  | ExceptionOutputValue
  | "None";

export interface OutputCell {
  id: CellId;
  values: OutputValue[];
  status: OutputCellState;
  editor_cell: EditorCell;
}

export interface Run {
  id: RunId;
  title: string;
  kernel_state: KernelState;
  kernel_state_message: string | null;
  output_cells: OutputCell[];
}

export interface Notebook {
  id: NotebookId;
  editor_cells: EditorCell[];
  runs: Run[];
  waiting_for_fresh: EditorCell[];
}

export interface NotebookDesc {
  id: NotebookId;
  editor_cells: EditorCell[];
}
