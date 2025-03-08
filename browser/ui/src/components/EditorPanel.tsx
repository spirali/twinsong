import React, { Children, Dispatch, useCallback, useRef } from "react";
import {
  EditorCell,
  EditorNamedNode,
  EditorNode,
  EditorNodeId,
  Notebook,
} from "../core/notebook";
import { useDispatch } from "./StateProvider";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-python";
import "prismjs/themes/prism.css";
import { useSendCommand } from "./WsProvider";
import { newEdtorCell, runCell, saveNotebook } from "../core/actions";
import {
  SquarePlus,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { usePushNotification } from "./NotificationProvider";

function getFirst(node: EditorNode): EditorNodeId | null {
  if (node.type === "Node" && node.open && node.children.length > 0) {
    return node.children[0].id;
  } else {
    return null;
  }
}

const EditorNamedNodeRenderer: React.FC<{
  notebook: Notebook;
  path: EditorNodeId[];
  node: EditorNamedNode;
  depth: number;
  prev_id: string | null;
  next_id: string | null;
}> = ({ notebook, path, node, depth, prev_id, next_id }) => {
  const dispatch = useDispatch()!;
  const is_selected = notebook.selected_editor_cell_id == node.id;
  return (
    <div className="w-full my-1">
      <div
        id={node.id}
        tabIndex={-1}
        className={`select-none flex rounded px-2 mb-1 text-gray-500 font-semibold focus:outline-0 ${is_selected ? "bg-blue-200" : "hover:bg-blue-50"}`}
        onClick={() => {
          console.log(node.id, document.getElementById(node.id));
          document.getElementById(node.id)?.focus();
          // dispatch({
          //   type: "select_editor_cell",
          //   notebook_id: notebook.id,
          //   editor_cell_id: node.id,
          // })
        }}
        onFocus={() =>
          dispatch({
            type: "select_editor_cell",
            notebook_id: notebook.id,
            editor_cell_id: node.id,
          })
        }
        onBlur={() =>
          dispatch({
            type: "select_editor_cell",
            notebook_id: notebook.id,
            editor_cell_id: null,
          })
        }
        onKeyDown={(e) => {
          console.log(e.key, prev_id);
          if (e.key === "ArrowUp" && prev_id) {
            e.preventDefault();
            move(prev_id, true);
          }
          if (e.key === "ArrowDown" && (next_id || getFirst(node))) {
            e.preventDefault();
            move((getFirst(node) || next_id)!, false);
          }
          if (
            (e.key === "ArrowLeft" && node.open) ||
            (e.key === "ArrowRight" && !node.open)
          ) {
            e.preventDefault();
            dispatch({
              type: "toggle_editor_node",
              notebook_id: notebook.id,
              path,
            });
          }
        }}
      >
        <button
          className="mr-1"
          onClick={(e) => {
            e.stopPropagation();
            dispatch({
              type: "toggle_editor_node",
              notebook_id: notebook.id,
              path,
            });
          }}
        >
          {node.open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {node.name}
      </div>
      {node.open && (
        <div className="ml-2">
          {node.children.map((child, i) => {
            const p = [...path, child.id];
            const child_prev_id = i == 0 ? node.id : node.children[i - 1].id;
            const child_next_id =
              i == node.children.length - 1 ? next_id : node.children[i + 1].id;
            if (child.type === "Node") {
              return (
                <EditorNamedNodeRenderer
                  key={child.id}
                  notebook={notebook}
                  path={p}
                  node={child}
                  depth={depth + 1}
                  prev_id={child_prev_id}
                  next_id={child_next_id}
                />
              );
            } else if (child.type === "Cell") {
              return (
                <EditorCellRenderer
                  key={child.id}
                  notebook={notebook}
                  path={p}
                  cell={child}
                  prev_id={child_prev_id}
                  next_id={child_next_id}
                />
              );
            }
          })}
        </div>
      )}
    </div>
  );
};

function checkIfLastLine(
  event:
    | React.KeyboardEvent<HTMLDivElement>
    | React.KeyboardEvent<HTMLTextAreaElement>,
) {
  const textarea = event.target as HTMLTextAreaElement;
  const cursorPosition = textarea.selectionStart;
  return !textarea.value.substring(cursorPosition).includes("\n");
}

function checkIfFirstLine(
  event:
    | React.KeyboardEvent<HTMLDivElement>
    | React.KeyboardEvent<HTMLTextAreaElement>,
) {
  const textarea = event.target as HTMLTextAreaElement;
  const cursorPosition = textarea.selectionStart;
  return !textarea.value.substring(0, cursorPosition).includes("\n");
}

function move(
  new_id: string,
  is_up: boolean,
) {
  const element = document.getElementById(new_id)!;
  const textArea = element.getElementsByTagName("textarea")[0];
  if (textArea) {
    textArea.focus();
    const pos = is_up ? textArea.value.length : 0;
    textArea.setSelectionRange(pos, pos);
  } else {
    element.focus();
    // dispatch({
    //   type: "select_editor_cell",
    //   notebook_id: notebook.id,
    //   editor_cell_id: new_id,
    // })
  }
}

const EditorCellRenderer: React.FC<{
  notebook: Notebook;
  path: EditorNodeId[];
  cell: EditorCell;
  prev_id: string | null;
  next_id: string | null;
}> = ({ notebook, path, cell, prev_id, next_id }) => {
  const dispatch = useDispatch()!;
  const sendCommand = useSendCommand()!;
  const pushNotification = usePushNotification();
  const is_selected = notebook.selected_editor_cell_id == cell.id;
  console.log(cell, prev_id);
  return (
    <div
      className={`pl-1 border-l-6 ${is_selected ? "border-blue-200" : "border-white"} `}
    >
      <div className="mb-1 border border-gray-400 rounded-md overflow-hidden">
        <Editor
          onFocus={() =>
            dispatch({
              type: "select_editor_cell",
              notebook_id: notebook.id,
              editor_cell_id: cell.id,
            })
          }
          onBlur={() =>
            dispatch({
              type: "select_editor_cell",
              notebook_id: notebook.id,
              editor_cell_id: null,
            })
          }
          id={cell.id}
          value={cell.value}
          onValueChange={(code) => {
            dispatch({
              type: "cell_edit",
              notebook_id: notebook.id,
              path,
              value: code,
            });
          }}
          highlight={(code) => highlight(code, languages.python)}
          padding={10}
          style={{
            fontFamily: '"Fira code", "Fira Mono", monospace',
            fontSize: 12,
          }}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === "Enter") {
              e.preventDefault();
              runCell(cell, notebook, dispatch, sendCommand, pushNotification);
            }
            if (e.key === "ArrowUp" && prev_id && checkIfFirstLine(e)) {
              e.preventDefault();
              move(prev_id, true);
            }
            if (e.key === "ArrowDown" && next_id && checkIfLastLine(e)) {
              e.preventDefault();
              move(next_id, false);
            }
          }}
        />
      </div>
    </div>
  );
};

const ToolButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
}> = ({ onClick, children }) => {
  return (
    <button
      onClick={onClick}
      className="bg-gray-200 text-black px-3 py-2 rounded hover:bg-gray-300"
    >
      {children}
    </button>
  );
};

const EditorPanel: React.FC<{ notebook: Notebook }> = ({ notebook }) => {
  const dispatch = useDispatch()!;
  const sendCommand = useSendCommand()!;
  const onSave = useCallback(() => {
    saveNotebook(notebook, dispatch, sendCommand);
  }, [notebook, dispatch, sendCommand]);
  return (
    <div className="h-full">
      {/* Toolbar */}
      <div className="sticky top-0 bg-white p-1 pb-3">
        <div className="flex space-x-2">
          <ToolButton onClick={onSave}>
            {notebook.save_in_progress ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
          </ToolButton>

          <ToolButton
            onClick={() => {
              newEdtorCell(notebook, dispatch);
            }}
          >
            <div className="flex items-center">
              <SquarePlus className="w-4 h-4 mr-2" /> Add code cell
            </div>
          </ToolButton>
        </div>
      </div>

      {/* Cells Container */}
      <div className="pl-1 pr-2 pt-2 pb-2 space-y-4 overflow-auto">
        {/*notebook.editor_cells.map((cell, index) => (
          <EditorCellRenderer
            key={cell.id}
            notebook={notebook}
            cell={cell}
            prev_id={notebook.editor_cells[index - 1]?.id || null}
            next_id={notebook.editor_cells[index + 1]?.id || null}
          />
        ))*/}
        <EditorNamedNodeRenderer
          notebook={notebook}
          path={[]}
          node={notebook.editor_root}
          depth={0}
          prev_id={null}
          next_id={null}
        />
      </div>
    </div>
  );
};

export default EditorPanel;
