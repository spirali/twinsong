import { applyGlobalsUpdate } from "./jobject";
import { SerializedGlobalsUpdate } from "./messages";
import {
  EditorGroupNode,
  EditorNode,
  EditorNodeId,
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
  cell_id: EditorNodeId;
  flag: OutputCellFlag;
  value: OutputValue;
  update: null | SerializedGlobalsUpdate;
  kernel_state: KernelState;
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

interface ToggleEditorNode {
  type: "toggle_editor_node";
  notebook_id: NotebookId;
  node_id: EditorNodeId;
}

export type InsertType = "before" | "after" | "child";

interface NewEditorNodeAction {
  type: "new_editor_node";
  notebook_id: NotebookId;
  path: EditorNodeId[];
  editor_node: EditorNode;
  insert_type: InsertType;
}

interface SelectEditorNodeAction {
  type: "select_editor_node";
  notebook_id: NotebookId;
  editor_node_id: EditorNodeId | null;
}

interface ToggleOpenObjectAction {
  type: "toggle_open_object";
  notebook_id: NotebookId;
  run_id: RunId;
  object_path: string;
}

interface UpdateEditorNode {
  type: "update_editor_node";
  notebook_id: NotebookId;
  path: EditorNodeId[];
  node_update: Partial<EditorNode>;
}

interface RemoveEditorNode {
  type: "remove_editor_node";
  notebook_id: NotebookId;
  path: EditorNodeId[];
}

export interface DirEntry {
  path: string;
  entry_type: "Notebook" | "LoadedNotebook" | "Dir" | "File";
}

interface SetDirEntries {
  type: "set_dir_entries";
  entries: DirEntry[];
}

interface SetDialog {
  type: "set_dialog";
  dialog: DialogConfig | null;
}

export type StateAction =
  | AddNotebookAction
  | FreshRunAction
  | KernelStateChangedAction
  | NewOutputAction
  | NewOutputCellAction
  | SetCurrentRunAction
  | SetRunViewModeAction
  | NewEditorNodeAction
  | SelectEditorNodeAction
  | SetSelectedNotebookAction
  | SetDirEntries
  | SaveNotebookAction
  | CloseRunAction
  | ToggleEditorNode
  | ToggleOpenObjectAction
  | UpdateEditorNode
  | RemoveEditorNode
  | SetDialog;

export interface DialogConfig {
  title: string;
  value: string;
  okText: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export interface State {
  notebooks: Notebook[];
  dir_entries: DirEntry[];
  selected_notebook: Notebook | null;
  dialog: DialogConfig | null;
}

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

function getEditorNode(
  node: EditorGroupNode,
  path: EditorNodeId[],
): EditorNode | null {
  if (path.length === 0) {
    return node;
  }
  for (const child of node.children) {
    if (child.id === path[0]) {
      if (child.type === "Cell") {
        return child;
      }
      return getEditorNode(child, path.slice(1));
    }
  }
  return null;
}

function updateEditor(
  node: EditorNode,
  path: EditorNodeId[],
  target: EditorNode,
): EditorNode {
  if (node.type === "Cell" || path.length === 0) {
    return target;
  }
  return {
    ...node,
    children: node.children.map((c) => {
      if (c.id == path[0]) {
        return updateEditor(c, path.slice(1), target);
      } else {
        return c;
      }
    }),
  };
}

export function stateReducer(state: State, action: StateAction): State {
  console.log("action", action);
  switch (action.type) {
    case "update_editor_node": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const editor_node = getEditorNode(notebook.editor_root, action.path);
      if (!editor_node) {
        return state;
      }
      const editor_root = updateEditor(notebook.editor_root, action.path, {
        ...editor_node,
        ...action.node_update,
      } as EditorNode);
      const updated_notebook = { ...notebook, editor_root } as Notebook;
      return updateNotebooks(state, updated_notebook);
    }
    case "new_editor_node": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      let editor_root;
      let editor_open_nodes = notebook.editor_open_nodes;
      if (action.insert_type === "child") {
        const editor_node = getEditorNode(notebook.editor_root, action.path);
        if (editor_node === null || editor_node.type !== "Group") {
          return state;
        }
        editor_root = updateEditor(notebook.editor_root, action.path, {
          ...editor_node,
          children: [...editor_node.children, action.editor_node],
        } as EditorNode);
        if (!notebook.editor_open_nodes.has(editor_node.id)) {
          editor_open_nodes = new Set(notebook.editor_open_nodes);
          editor_open_nodes.add(editor_node.id);
        }
      } else {
        const path = action.path.slice(0, -1);
        const parent_node = getEditorNode(notebook.editor_root, path);
        if (parent_node === null || parent_node.type !== "Group") {
          return state;
        }
        const idx = parent_node.children.findIndex(
          (c) => c.id === action.path[action.path.length - 1],
        );
        if (idx === -1) {
          return state;
        }
        editor_root = updateEditor(notebook.editor_root, path, {
          ...parent_node,
          children:
            action.insert_type === "before"
              ? [
                  ...parent_node.children.slice(0, idx),
                  action.editor_node,
                  ...parent_node.children.slice(idx),
                ]
              : [
                  ...parent_node.children.slice(0, idx + 1),
                  action.editor_node,
                  ...parent_node.children.slice(idx + 1),
                ],
        } as EditorNode);
      }
      const new_notebook = {
        ...notebook,
        editor_root,
        editor_open_nodes,
      } as Notebook;
      return updateNotebooks(state, new_notebook);
    }
    case "remove_editor_node": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const path = action.path.slice(0, -1);
      const parent_node = getEditorNode(notebook.editor_root, path);
      if (parent_node === null || parent_node.type !== "Group") {
        return state;
      }
      const idx = parent_node.children.findIndex(
        (c) => c.id === action.path[action.path.length - 1],
      );
      if (idx === -1) {
        return state;
      }
      const editor_root = updateEditor(notebook.editor_root, path, {
        ...parent_node,
        children: parent_node.children.filter(
          (n) => n.id !== action.path[action.path.length - 1],
        ),
      } as EditorNode);
      const new_notebook = {
        ...notebook,
        editor_root,
      } as Notebook;
      return updateNotebooks(state, new_notebook);
    }
    case "add_notebook": {
      const path = action.notebook.path;
      const runs = action.notebook.runs.map((r) => {
        const globals = applyGlobalsUpdate(r.globals, null);
        return {
          ...r,
          globals,
          view_mode: "outputs",
          open_objects: new Set(),
        } as Run;
      });
      const notebook = {
        id: action.notebook.id,
        editor_root: action.notebook.editor_root,
        editor_open_nodes: new Set(action.notebook.editor_open_nodes),
        runs: runs,
        waiting_for_fresh: [],
        current_run_id: runs.length > 0 ? runs[0].id : null,
        selected_editor_node_id: null,
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
    case "toggle_editor_node": {
      const notebook = state.notebooks.find((n) => n.id == action.notebook_id)!;
      const editor_open_nodes = new Set(notebook.editor_open_nodes);
      const node_id = action.node_id;
      if (editor_open_nodes.has(node_id)) {
        editor_open_nodes.delete(node_id);
      } else {
        editor_open_nodes.add(node_id);
      }
      const new_notebook = {
        ...notebook,
        editor_open_nodes,
        selected_editor_node_id: node_id,
      } as Notebook;
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
            globals: { name: "", variables: [], children: [] },
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
            if (action.update) {
              globals = applyGlobalsUpdate(action.update, r.globals);
            }
            return {
              ...r,
              globals,
              output_cells,
              kernel_state: action.kernel_state,
            } as Run;
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
    case "select_editor_node": {
      const notebook = state.selected_notebook!;
      const new_notebook = {
        ...notebook,
        selected_editor_node_id: action.editor_node_id,
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
    case "set_dialog": {
      return { ...state, dialog: action.dialog };
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
  dialog: null,
};
