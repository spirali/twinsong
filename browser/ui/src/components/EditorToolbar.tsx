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
import { FilePlus, FolderPlus, Pencil, Play, Plus, Trash2 } from "lucide-react";

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
}> = ({ className, node, path, notebook }) => {
  const isGroup = node.type === "Group";
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
          <Pencil size={14} />
        </NodeButton>
      )}
      <NodeButton onClick={() => {}} isGroup={isGroup}>
        <Play size={14} />
      </NodeButton>
      <NodeButton onClick={() => {}} isGroup={isGroup}>
        <FolderPlus size={14} />
      </NodeButton>
      <NodeButton onClick={() => {}} isGroup={isGroup}>
        <Plus size={14} />
      </NodeButton>
      <NodeButton onClick={() => {}} isGroup={isGroup}>
        <Trash2 size={14} />
      </NodeButton>
    </div>
  );
};
