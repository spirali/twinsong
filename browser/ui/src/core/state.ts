import { extractGlobals } from "./jobject";
import {
  CellId,
  EditorCell,
  KernelState,
  Notebook,
  NotebookDesc,
  NotebookId,
  OutputCell,
  OutputCellFlag,
  OutputValue,
  Run,
  RunId,
  RunViewMode,
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
  flag: OutputCellFlag;
  value: OutputValue;
  globals: [string, string][] | null;
}

interface SetCurrentRunAction {
  type: "set_current_run";
  notebook_id: NotebookId;
  run_id: RunId;
}

interface CloseRunAction {
  type: "close_run";
  notebook_id: NotebookId;
  run_id: RunId;
}

interface SetRunViewModeAction {
  type: "set_run_view_mode";
  notebook_id: NotebookId;
  run_id: RunId;
  view_mode: RunViewMode;
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

interface ToggleOpenObjectAction {
  type: "toggle_open_object";
  notebook_id: NotebookId;
  run_id: RunId;
  object_path: string;
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
  | SetRunViewModeAction
  | NewEditorCellAction
  | SelectEditorCellAction
  | SetSelectedNotebookAction
  | SetDirEntries
  | SaveNotebookAction
  | CloseRunAction
  | ToggleOpenObjectAction;

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
      const runs = action.notebook.runs.map((r) => {
        const globals = extractGlobals(r.globals, []);
        return {
          ...r,
          globals,
          view_mode: "outputs",
          open_objects: new Set(),
        } as Run;
      });
      const notebook = {
        id: action.notebook.id,
        editor_cells: action.notebook.editor_cells,
        runs: runs,
        waiting_for_fresh: [],
        current_run_id: runs.length > 0 ? runs[0].id : null,
        selected_editor_cell_id: null,
        save_in_progress: false,
        globals: [],
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
            globals: [],
            view_mode: "outputs",
            open_objects: new Set(),
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
            let finished = action.flag == "Success" || action.flag == "Fail";
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
                return { ...c, flag: action.flag, values } as OutputCell;
              }
              if (finished && c.flag == "Pending") {
                finished = false;
                return { ...c, flag: "Running" } as OutputCell;
              } else {
                return c;
              }
            });
            let globals = r.globals;
            if (action.globals) {
              globals = extractGlobals(action.globals, r.globals);
            }
            return { ...r, globals, output_cells } as Run;
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
    case "close_run": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const runs = notebook.runs.filter((r) => r.id != action.run_id);
      let current_run_id;
      if (notebook.runs.length <= 1) {
        current_run_id = null;
      } else {
        const idx = notebook.runs.findIndex((r) => r.id == action.run_id);
        if (notebook.runs.length - 1 == idx) {
          current_run_id = notebook.runs[idx - 1].id;
        } else {
          current_run_id = notebook.runs[idx + 1].id;
        }
      }
      const new_notebook = { ...notebook, runs, current_run_id };
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
    case "set_dir_entries": {
      return {
        ...state,
        dir_entries: action.entries,
      };
    }
    case "set_run_view_mode": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const new_notebook = {
        ...notebook,
        runs: notebook.runs.map((r) =>
          r.id == action.run_id ? { ...r, view_mode: action.view_mode } : r,
        ),
      };
      return updateNotebooks(state, new_notebook);
    }
    case "toggle_open_object": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;

      const new_notebook = {
        ...notebook,
        runs: notebook.runs.map((r) => {
          if (r.id == action.run_id) {
            const open_objects = new Set(r.open_objects);
            if (open_objects.has(action.object_path)) {
              open_objects.delete(action.object_path);
            } else {
              open_objects.add(action.object_path);
            }
            return { ...r, open_objects };
          } else {
            return r;
          }
        }),
      };
      return updateNotebooks(state, new_notebook);
    }
    default: {
      throw Error("Unknown action");
    }
  }
}

export const INITIAL_STATE: State = {
  notebooks: [],
  dir_entries: [],
  selected_notebook: null,
};
