import {
  CellId,
  EditorCell,
  KernelState,
  Notebook,
  NotebookDesc,
  NotebookId,
  OutputCell,
  OutputCellState,
  OutputValue,
  Run,
  RunId,
  TextOutputValue,
} from "./notebook";

interface SetSelectedNotebookAction {
  type: "set_selected_notebook";
  id: NotebookId | null;
}

interface EditCellAction {
  type: "cell_edit";
  notebook_id: NotebookId;
  id: unknown;
  value: string;
}

interface FreshRunAction {
  type: "fresh_run";
  notebook_id: NotebookId;
  run_id: RunId;
  run_title: string;
}

interface NewOutputCellAction {
  type: "new_output_cell";
  notebook_id: NotebookId;
  run_id: RunId;
  cell: OutputCell;
}

interface AddNotebookAction {
  type: "add_notebook";
  notebook: NotebookDesc;
}

interface KernelStateChangedAction {
  type: "kernel_changed";
  notebook_id: NotebookId;
  run_id: RunId;
  kernel_state: KernelState;
}

interface NewOutputAction {
  type: "new_output";
  notebook_id: NotebookId;
  run_id: RunId;
  cell_id: CellId;
  status: OutputCellState;
  value: OutputValue;
}

interface SetCurrentRunAction {
  type: "set_current_run";
  notebook_id: NotebookId;
  run_id: RunId;
}

interface SaveNotebookAction {
  type: "save_notebook";
  notebook_id: NotebookId;
  save_in_progress: boolean;
}

interface NewEditorCellAction {
  type: "new_editor_cell";
  notebook_id: NotebookId;
  editor_cell: EditorCell;
}

interface SelectEditorCellAction {
  type: "select_editor_cell";
  notebook_id: NotebookId;
  editor_cell_id: CellId | null;
}

export interface DirEntry {
  path: string;
  entry_type: "Notebook" | "LoadedNotebook" | "Dir" | "File";
}

interface SetDirEntries {
  type: "set_dir_entries";
  entries: DirEntry[];
}

export interface State {
  notebooks: Notebook[];
  dir_entries: DirEntry[];
  selected_notebook: Notebook | null;
}

export type StateAction =
  | EditCellAction
  | AddNotebookAction
  | FreshRunAction
  | KernelStateChangedAction
  | NewOutputAction
  | NewOutputCellAction
  | SetCurrentRunAction
  | NewEditorCellAction
  | SelectEditorCellAction
  | SetSelectedNotebookAction
  | SetDirEntries
  | SaveNotebookAction;

function updateNotebooks(state: State, notebook: Notebook): State {
  return {
    ...state,
    notebooks: state.notebooks.map((n) => {
      if (n.id == notebook.id) {
        return notebook;
      } else {
        return n;
      }
    }),
    selected_notebook:
      state.selected_notebook?.id == notebook.id
        ? notebook
        : state.selected_notebook,
  };
}

export function stateReducer(state: State, action: StateAction): State {
  console.log("action", action);
  switch (action.type) {
    case "add_notebook": {
      const path = action.notebook.path;
      const runs = action.notebook.runs;
      const notebook = {
        id: action.notebook.id,
        editor_cells: action.notebook.editor_cells,
        runs: runs,
        waiting_for_fresh: [],
        current_run_id: runs.length > 0 ? runs[0].id : null,
        selected_editor_cell_id: null,
        save_in_progress: false,
        path,
      } as Notebook;

      const dir_entries = state.dir_entries.map((e) =>
        e.path == path
          ? ({ ...e, entry_type: "LoadedNotebook" } as DirEntry)
          : e,
      );
      return {
        ...state,
        notebooks: [...state.notebooks, notebook],
        selected_notebook: notebook,
        dir_entries,
      };
    }
    case "set_selected_notebook": {
      return {
        ...state,
        selected_notebook:
          state.notebooks.find((n) => n.id == action.id) || null,
      };
    }
    case "cell_edit": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const editor_cells = notebook.editor_cells.map((c) => {
        if (c.id == action.id) {
          return { ...c, value: action.value };
        } else {
          return c;
        }
      });
      const new_notebook = { ...notebook, editor_cells: editor_cells };
      return updateNotebooks(state, new_notebook);
    }
    case "fresh_run": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const new_notebook = {
        ...notebook,
        runs: [
          ...notebook.runs,
          {
            id: action.run_id,
            title: action.run_title,
            kernel_state: { type: "Init" },
            output_cells: [],
            kernel_state_message: null,
          } as Run,
        ],
        current_run_id: action.run_id,
      };
      return updateNotebooks(state, new_notebook);
    }
    case "kernel_changed": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const new_notebook = {
        ...notebook,
        runs: notebook.runs.map((r) => {
          if (r.id == action.run_id) {
            if (
              action.kernel_state.type == "Running" &&
              r.output_cells.length > 0
            ) {
              const output_cells = r.output_cells.map((cell, index) =>
                index === 0 ? { ...cell, status: "running" } : cell,
              );
              return {
                ...r,
                kernel_state: action.kernel_state,
                output_cells,
              } as Run;
            } else {
              return {
                ...r,
                kernel_state: action.kernel_state,
              } as Run;
            }
          } else {
            return r;
          }
        }),
      };
      return updateNotebooks(state, new_notebook);
    }
    case "new_output_cell": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const new_notebook = {
        ...notebook,
        runs: notebook.runs.map((r) => {
          if (r.id == action.run_id) {
            return {
              ...r,
              output_cells: [...r.output_cells, action.cell],
            } as Run;
          } else {
            return r;
          }
        }),
      };
      return updateNotebooks(state, new_notebook);
    }
    case "new_output": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const new_notebook = {
        ...notebook,
        runs: notebook.runs.map((r) => {
          if (r.id == action.run_id) {
            let finished =
              action.status == "success" || action.status == "error";
            const output_cells = r.output_cells.map((c) => {
              if (c.id === action.cell_id) {
                let values;
                if (
                  action.value.type == "Text" &&
                  c.values.length > 0 &&
                  c.values[c.values.length - 1].type == "Text"
                ) {
                  // Concatenate text values if both are Text type
                  values = [
                    ...c.values.slice(0, -1),
                    {
                      type: "Text",
                      value:
                        (c.values[c.values.length - 1] as TextOutputValue)
                          .value + (action.value as TextOutputValue).value,
                    },
                  ];
                } else {
                  values = [...c.values, action.value];
                }
                return { ...c, status: action.status, values } as OutputCell;
              }
              if (finished && c.status == "pending") {
                finished = false;
                return { ...c, status: "running" } as OutputCell;
              } else {
                return c;
              }
            });
            return { ...r, output_cells };
          } else {
            return r;
          }
        }),
      };
      return updateNotebooks(state, new_notebook);
    }
    case "set_current_run": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const new_notebook = { ...notebook, current_run_id: action.run_id };
      return updateNotebooks(state, new_notebook);
    }
    case "new_editor_cell": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const new_notebook = {
        ...notebook,
        editor_cells: [...notebook.editor_cells, action.editor_cell],
      };
      return updateNotebooks(state, new_notebook);
    }
    case "select_editor_cell": {
      const notebook = state.selected_notebook!;
      const new_notebook = {
        ...notebook,
        selected_editor_cell_id: action.editor_cell_id,
      };
      return updateNotebooks(state, new_notebook);
    }
    case "save_notebook": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const new_notebook = {
        ...notebook,
        save_in_progress: action.save_in_progress,
      };
      return updateNotebooks(state, new_notebook);
    }
    default: {
      throw Error("Unknown action");
    }
    case "set_dir_entries": {
      return {
        ...state,
        dir_entries: action.entries,
      };
    }
  }
}

export const INITIAL_STATE: State = {
  notebooks: [],
  dir_entries: [],
  selected_notebook: null,
};
