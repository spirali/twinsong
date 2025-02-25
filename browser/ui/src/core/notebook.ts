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
  type: "Text",
  value: string
}

export interface HtmlOutputValue {
  type: "Html",
  value: string
}

export interface ExceptionOutputValue {
  type: "Exception",
  value: {
    message: string,
    traceback: string
  }
}

export type OutputValue =
  | TextOutputValue
  | HtmlOutputValue
  | ExceptionOutputValue
  | { type: "None" };

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
  path: string;
}
