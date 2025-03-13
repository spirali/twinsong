import React, {
  Children,
  Dispatch,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { EditorNode, EditorNodeId, Notebook } from "../core/notebook";
import { useDispatch } from "./StateProvider";
import { focusId } from "./EditorPanel";
import {
  LuPlus,
  LuFolderPlus,
  LuPencil,
  LuPlay,
  LuTrash2,
} from "react-icons/lu";
import {
  newEditorCode,
  newEditorGroup,
  removeEditorNode,
} from "../core/actions";

const NodeButton: React.FC<{
  onClick: () => void;
  isGroup: boolean;
  children: React.ReactNode;
}> = ({ onClick, isGroup, children }) => {
  const className = isGroup
    ? "text-blue bg-blue-100 p-1 mr-1 rounded hover:bg-gray-400"
    : "text-gray-700 bg-gray-50 p-1 mr-1 rounded hover:bg-gray-400";
  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={className}
    >
      {children}
    </div>
  );
};

export const NodeToolbar: React.FC<{
  className: string;
  node: EditorNode;
  path: EditorNodeId[];
  notebook: Notebook;
  isRoot: boolean;
}> = ({ className, node, path, notebook, isRoot }) => {
  const isGroup = node !== null && node.type === "Group";
  const dispatch = useDispatch()!;
  return (
    <div className={"flex " + className}>
      {isGroup && (
        /* Rename */
        <NodeButton
          onClick={() => {
            dispatch({
              type: "set_dialog",
              dialog: {
                title: "Group name",
                value: node.name,
                okText: "Rename group",
                onCancel: () => {
                  focusId(node.id);
                },
                onConfirm: (value: string) => {
                  dispatch({
                    type: "update_editor_node",
                    notebook_id: notebook.id,
                    path,
                    node_update: { name: value },
                  });
                  focusId(node.id);
                },
              },
            });
          }}
          isGroup={isGroup}
        >
          <LuPencil size={14} />
        </NodeButton>
      )}
      {/* <NodeButton onClick={() => { }} isGroup={isGroup}>
        <LuPlay size={14} />
      </NodeButton> */}
      {isGroup && (
        <NodeButton
          onClick={() => {
            newEditorGroup(notebook, node, path, "child", dispatch);
          }}
          isGroup={isGroup}
        >
          <LuFolderPlus size={14} />
        </NodeButton>
      )}
      {isGroup && (
        <NodeButton
          onClick={() => {
            newEditorCode(notebook, path, "child", dispatch);
          }}
          isGroup={isGroup}
        >
          <LuPlus size={14} />
        </NodeButton>
      )}
      {!isRoot && (
        <NodeButton
          onClick={() => {
            removeEditorNode(notebook, path, dispatch);
          }}
          isGroup={isGroup}
        >
          <LuTrash2 size={14} />
        </NodeButton>
      )}
    </div>
  );
};
