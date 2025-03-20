import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-python";
import "prismjs/themes/prism.css";
import React, { useCallback } from "react";
import {
  LuArrowBigUp,
  LuChevronDown,
  LuChevronRight,
  LuFolderPlus,
  LuGlobe,
  LuLoaderCircle,
  LuPlus,
  LuSave
} from "react-icons/lu";
import Editor from "react-simple-code-editor";
import {
  newEditorCode,
  newEditorGroup,
  runCode,
  saveNotebook,
} from "../core/actions";
import {
  EditorCell,
  EditorGroupNode,
  EditorNode,
  EditorNodeId,
  EditorScope,
  Notebook,
} from "../core/notebook";
import { NodeToolbar } from "./EditorToolbar";
import { usePushNotification } from "./NotificationProvider";
import { useDispatch } from "./StateProvider";
import { useSendCommand } from "./WsProvider";

const EditorNamedNodeRenderer: React.FC<{
  notebook: Notebook;
  path: EditorNodeId[];
  node: EditorGroupNode;
  depth: number;
  orderedNodes: EditorNode[];
}> = ({ notebook, path, node, depth, orderedNodes }) => {
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
          if (e.key === "ArrowUp") {
            e.preventDefault();
            move(node, orderedNodes, true);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            move(node, orderedNodes, false);
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
            runCode(path, notebook, dispatch, sendCommand, pushNotification);
          }
        }}
      >
        <div className="mr-4 flex items-center">
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
          <div className="mr-2 text-purple-400">
            {node.scope === EditorScope.Own ? (
              <LuGlobe size={18} />
            ) : (
              <LuArrowBigUp size={18} />
            )}
          </div>
          {node.name}
        </div>
        <div>
          {isSelected && (
            <NodeToolbar
              className=""
              node={node}
              notebook={notebook}
              path={path}
              isRoot={depth === 0}
            />
          )}
        </div>
      </div>
      {isOpen && (
        <div className="ml-2">
          {node.children.length == 0 && (
            <div className="flex ml-5">
              <div className="italic mr-3">Group is empty</div>
              <NodeButton2
                onClick={() => {
                  newEditorGroup(notebook, node, path, "child", dispatch);
                }}
              >
                <div className="inline-flex items-center">
                  <LuFolderPlus className="mr-2" />
                  Add group
                </div>
              </NodeButton2>
              <NodeButton2
                onClick={() => {
                  newEditorCode(notebook, path, "child", dispatch);
                }}
              >
                <div className="inline-flex items-center">
                  <LuPlus className="mr-2" />
                  Add code
                </div>
              </NodeButton2>
            </div>
          )}
          {node.children.map((child) => {
            const p = [...path, child.id];
            if (child.type === "Group") {
              return (
                <EditorNamedNodeRenderer
                  key={child.id}
                  notebook={notebook}
                  path={p}
                  node={child}
                  depth={depth + 1}
                  orderedNodes={orderedNodes}
                />
              );
            } else if (child.type === "Cell") {
              return (
                <EditorCellRenderer
                  key={child.id}
                  notebook={notebook}
                  path={p}
                  cell={child}
                  orderedNodes={orderedNodes}
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

function move(node: EditorNode, orderedNodes: EditorNode[], is_up: boolean) {
  let idx = orderedNodes.indexOf(node);
  if (is_up) {
    if (idx === 0) {
      return;
    }
    idx -= 1;
  } else {
    if (idx === orderedNodes.length - 1) {
      return;
    }
    idx += 1;
  }
  let newId = orderedNodes[idx].id;

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
  orderedNodes: EditorNode[];
}> = ({ notebook, path, cell, orderedNodes }) => {
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
          isRoot={false}
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
          onBlur={() => {
            // dispatch({
            //   type: "select_editor_node",
            //   notebook_id: notebook.id,
            //   editor_node_id: null,
            // })
          }}
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
              runCode(path, notebook, dispatch, sendCommand, pushNotification);
            }
            if (e.key === "ArrowUp" && checkIfFirstLine(e)) {
              e.preventDefault();
              move(cell, orderedNodes, true);
            }
            if (e.key === "ArrowDown" && checkIfLastLine(e)) {
              e.preventDefault();
              move(cell, orderedNodes, false);
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

function crawlOpen(
  node: EditorNode,
  opens: Set<EditorNodeId>,
  out: EditorNode[],
) {
  out.push(node);
  if (node.type === "Group" && opens.has(node.id)) {
    for (const child of node.children) {
      crawlOpen(child, opens, out);
    }
  }
}

const EditorPanel: React.FC<{ notebook: Notebook }> = ({ notebook }) => {
  const dispatch = useDispatch()!;
  const sendCommand = useSendCommand()!;
  const onSave = useCallback(() => {
    saveNotebook(notebook, dispatch, sendCommand);
  }, [notebook, dispatch, sendCommand]);
  const orderedNodes: EditorNode[] = [];
  crawlOpen(notebook.editor_root, notebook.editor_open_nodes, orderedNodes);
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
        </div>
      </div>

      {/* Cells Container */}
      <div
        className="pl-1 pr-2 pt-2 pb-2 space-y-4 overflow-auto"
        style={{ height: "calc(100vh - 150px)" }}
      >
        <EditorNamedNodeRenderer
          notebook={notebook}
          path={[]}
          node={notebook.editor_root}
          depth={0}
          orderedNodes={orderedNodes}
        />
      </div>
    </div>
  );
};

const NodeButton2: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
}> = ({ onClick, children }) => {
  const className =
    "text-gray-700 bg-gray-200 py-1 px-3 mr-1 rounded hover:bg-gray-400";
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={className}
    >
      {children}
    </button>
  );
};

export default EditorPanel;
