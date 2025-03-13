import React, {
  Children,
  Dispatch,
  useCallback,
  useRef,
  useState,
} from "react";
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
import { newEdtorCell, runCode, saveNotebook } from "../core/actions";
import {
  LuSquarePlus,
  LuSave,
  LuLoaderCircle,
  LuChevronDown,
  LuChevronRight,
} from "react-icons/lu";
import { usePushNotification } from "./NotificationProvider";
import { NodeToolbar } from "./EditorToolbar";

function getFirst(node: EditorNode, is_open: boolean): EditorNodeId | null {
  if (node.type === "Group" && is_open && node.children.length > 0) {
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
  const sendCommand = useSendCommand()!;
  const pushNotification = usePushNotification();

  const isSelected = notebook.selected_editor_node_id == node.id;
  const isOpen = notebook.editor_open_nodes.has(node.id);
  return (
    <div className="w-full my-1">
      <div
        id={node.id}
        tabIndex={-1}
        className={`flex justify-between select-none rounded px-2 py-1 mb-1 text-gray-500 font-semibold focus:outline-0 ${isSelected ? "bg-blue-200" : "hover:bg-blue-50"}`}
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
            type: "select_editor_node",
            notebook_id: notebook.id,
            editor_node_id: node.id,
          })
        }
        onBlur={() =>
          dispatch({
            type: "select_editor_node",
            notebook_id: notebook.id,
            editor_node_id: null,
          })
        }
        onKeyDown={(e) => {
          console.log(e.key, prev_id);
          if (e.key === "ArrowUp" && prev_id) {
            e.preventDefault();
            move(prev_id, true);
          }
          if (e.key === "ArrowDown" && (next_id || getFirst(node, isOpen))) {
            e.preventDefault();
            move((getFirst(node, isOpen) || next_id)!, false);
          }
          if (
            (e.key === "ArrowLeft" && isOpen) ||
            (e.key === "ArrowRight" && !isOpen)
          ) {
            e.preventDefault();
            dispatch({
              type: "toggle_editor_node",
              notebook_id: notebook.id,
              node_id: node.id,
            });
          }
          if (e.ctrlKey && e.key === "Enter") {
            e.preventDefault();
            runCode(node, notebook, dispatch, sendCommand, pushNotification);
          }
        }}
      >
        <div className="mr-4">
          <button
            className="mr-1"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({
                type: "toggle_editor_node",
                notebook_id: notebook.id,
                node_id: node.id,
              });
            }}
          >
            {isOpen ? (
              <LuChevronDown size={16} />
            ) : (
              <LuChevronRight size={16} />
            )}
          </button>
          {node.name}
        </div>
        <div>
          {isSelected && (
            <NodeToolbar
              className=""
              node={node}
              notebook={notebook}
              path={path}
            />
          )}
        </div>
      </div>
      {isOpen && (
        <div className="ml-2">
          {node.children.map((child, i) => {
            const p = [...path, child.id];
            const child_prev_id = i == 0 ? node.id : node.children[i - 1].id;
            const child_next_id =
              i == node.children.length - 1 ? next_id : node.children[i + 1].id;
            if (child.type === "Group") {
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

export function focusId(id: EditorNodeId) {
  const element = document.getElementById(id)!;
  const textArea = element.getElementsByTagName("textarea")[0];
  if (textArea) {
    textArea.focus();
  } else {
    element.focus();
  }
}

function move(newId: EditorNodeId, is_up: boolean) {
  const element = document.getElementById(newId)!;
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
  const isSelected = notebook.selected_editor_node_id == cell.id;
  return (
    <div
      className={`relative pl-1 border-l-6 ${isSelected ? "border-blue-200" : "border-white"} `}
    >
      {isSelected && (
        <NodeToolbar
          className="z-10 absolute top-0 right-0 mt-2 mr-2"
          node={cell}
          notebook={notebook}
          path={path}
        />
      )}
      <div className="mb-1 border border-gray-400 rounded-md overflow-hidden">
        <Editor
          onFocus={() =>
            dispatch({
              type: "select_editor_node",
              notebook_id: notebook.id,
              editor_node_id: cell.id,
            })
          }
          onBlur={() =>
            dispatch({
              type: "select_editor_node",
              notebook_id: notebook.id,
              editor_node_id: null,
            })
          }
          id={cell.id}
          value={cell.code}
          onValueChange={(code) => {
            dispatch({
              type: "update_editor_node",
              notebook_id: notebook.id,
              path,
              node_update: { code: code },
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
              runCode(cell, notebook, dispatch, sendCommand, pushNotification);
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
    <div className={"h-full"}>
      {/* Toolbar */}
      <div className="sticky top-0 bg-white p-1 pb-3">
        <div className="flex space-x-2">
          <ToolButton onClick={onSave}>
            {notebook.save_in_progress ? (
              <LuLoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              <LuSave className="w-4 h-4" />
            )}
          </ToolButton>

          <ToolButton
            onClick={() => {
              newEdtorCell(notebook, dispatch);
            }}
          >
            <div className="flex items-center">
              <LuSquarePlus className="w-4 h-4 mr-2" /> Add code cell
            </div>
          </ToolButton>
        </div>
      </div>

      {/* Cells Container */}
      <div
        className="pl-1 pr-2 pt-2 pb-2 space-y-4 overflow-auto"
        style={{ height: "calc(100vh - 150px)" }}
      >
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
