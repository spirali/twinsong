import {
  CellId,
  EditorCell,
  KernelState,
  Notebook,
  NotebookDesc,
  OutputCell,
  OutputCellState,
  OutputValue,
  Run,
  RunId,
  TextOutputValue,
} from "./notebook";

interface EditCellAction {
  type: "cell_edit";
  id: unknown;
  value: string;
}

interface FreshRunAction {
  type: "fresh_run";
  run_id: RunId;
  run_title: string;
}

interface NewOutputCellAction {
  type: "new_output_cell";
  run_id: RunId;
  cell: OutputCell;
}

interface SetNotebookAction {
  type: "set_notebook";
  notebook: NotebookDesc | null;
}

interface KernelStateChangedAction {
  type: "kernel_changed";
  run_id: RunId;
  kernel_state: KernelState;
  message: string | null;
}

interface NewOutputAction {
  type: "new_output";
  run_id: RunId;
  cell_id: CellId;
  status: OutputCellState;
  value: OutputValue;
}

interface SetCurrentRunAction {
  type: "set_current_run";
  run_id: RunId;
}

interface NewEditorCellAction {
  type: "new_editor_cell";
  editor_cell: EditorCell;
}

export interface State {
  notebook: Notebook | null;
  current_run_id: RunId | null;
}

export type StateAction =
  | EditCellAction
  | SetNotebookAction
  | FreshRunAction
  | KernelStateChangedAction
  | NewOutputAction
  | NewOutputCellAction
  | SetCurrentRunAction
  | NewEditorCellAction;

export function stateReducer(state: State, action: StateAction): State {
  console.log(action);
  if (action.type == "set_notebook") {
    if (action.notebook) {
      return {
        ...state,
        notebook: {
          id: action.notebook.id,
          editor_cells: action.notebook.editor_cells,
          runs: [],
          waiting_for_fresh: [],
        },
      };
    } else {
      return {
        ...state,
        notebook: null,
      };
    }
  }
  if (!state.notebook) {
    return state;
  }
  switch (action.type) {
    case "cell_edit": {
      const editor_cells = state.notebook.editor_cells.map((c) => {
        if (c.id == action.id) {
          return { ...c, value: action.value };
        } else {
          return c;
        }
      });
      return {
        ...state,
        notebook: { ...state.notebook, editor_cells: editor_cells },
      };
    }
    case "fresh_run": {
      const runs = [
        ...state.notebook.runs,
        {
          id: action.run_id,
          title: action.run_title,
          kernel_state: "init",
          output_cells: [],
          kernel_state_message: null,
        } as Run,
      ];
      return {
        ...state,
        notebook: { ...state.notebook, runs },
        current_run_id: runs[runs.length - 1].id,
      };
    }
    case "kernel_changed": {
      let runs = state.notebook.runs.map((r) => {
        if (r.id == action.run_id) {
          if (action.kernel_state == "ready" && r.output_cells.length > 0) {
            const output_cells = r.output_cells.map((cell, index) =>
              index === 0 ? { ...cell, status: "running" } : cell,
            );
            return {
              ...r,
              kernel_state: action.kernel_state,
              output_cells,
              kernel_state_message: action.message,
            } as Run;
          } else {
            return {
              ...r,
              kernel_state: action.kernel_state,
              kernel_state_message: action.message,
            } as Run;
          }
        } else {
          return r;
        }
      });
      return {
        ...state,
        notebook: { ...state.notebook, runs },
      };
    }
    case "new_output_cell": {
      const runs = state.notebook.runs.map((r) => {
        if (r.id == action.run_id) {
          return { ...r, output_cells: [...r.output_cells, action.cell] } as Run;
        } else {
          return r;
        }
      });
      return {
        ...state,
        notebook: { ...state.notebook, runs },
      };
    }
    case "new_output": {
      let finished = action.status == "success" || action.status == "error";
      const runs = state.notebook.runs.map((r) => {
        if (r.id == action.run_id) {
          const output_cells = r.output_cells.map((c) => {
            if (c.id === action.cell_id) {
              let values;
              if (
                action.value !== "None" &&
                "Text" in (action.value as object) &&
                c.values.length > 0 &&
                c.values[c.values.length - 1] !== "None" &&
                "Text" in (c.values[c.values.length - 1] as object)
              ) {
                // Concatenate text values if both are Text type
                values = [
                  ...c.values.slice(0, -1),
                  {
                    Text: {
                      value:
                        (c.values[c.values.length - 1] as TextOutputValue).Text
                          .value + (action.value as TextOutputValue).Text.value,
                    },
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
      });
      return {
        ...state,
        notebook: { ...state.notebook, runs },
      };
    }
    case "set_current_run": {
      return {
        ...state,
        current_run_id: action.run_id,
      };
    }
    case "new_editor_cell": {
      return {
        ...state,
        notebook: {
          ...state.notebook,
          editor_cells: [...state.notebook.editor_cells, action.editor_cell],
        },
      };
    }
    default: {
      throw Error("Unknown action");
    }
  }
}

export const INITIAL_STATE: State = {
  notebook: null,
  current_run_id: null,
};
