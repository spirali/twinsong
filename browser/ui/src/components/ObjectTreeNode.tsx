import React from "react";
import {
  LuChevronRight,
  LuChevronDown,
  LuBox,
  LuBrackets,
  LuSquare,
  LuCopyright,
  LuParentheses,
  LuBraces,
  LuCog,
} from "react-icons/lu";
import { VscCircle } from "react-icons/vsc";
import { JsonObjectId, JsonObjectStruct } from "../core/jobject";

// Tree Node Component
const ObjectTreeNode: React.FC<{
  struct: JsonObjectStruct;
  id: JsonObjectId;
  slotPath: string;
  slotName: string;
  depth: number;
  isRoot?: boolean;
  open_objects: Set<string>;
  toggleOpenObject: (object_path: string) => void;
}> = ({
  struct,
  id,
  slotPath,
  slotName,
  depth,
  isRoot = false,
  open_objects,
  toggleOpenObject,
}) => {
  const object = struct.objects.get(id)!;
  const isOpen = open_objects.has(slotPath);
  //const indent = `ml-${depth * 4}`;

  const getIcon = () => {
    if (object.kind === "list") {
      return <LuBrackets className="text-blue-500" size={16} />;
    }
    if (object.kind === "tuple") {
      return <LuParentheses className="text-blue-500" size={16} />;
    }
    if (object.kind === "dict") {
      return <LuBraces className="text-blue-500" size={16} />;
    }
    if (object.kind === "class") {
      return <LuCopyright className="text-blue-600" size={16} />;
    }
    if (object.kind === "dataclass") {
      return <LuBox className="text-blue-600" size={16} />;
    }
    if (object.kind === "module") {
      return <LuBox className="text-purple-600" size={16} />;
    }
    if (object.kind === "callable") {
      return <LuCog className="text-purple-600" size={16} />;
    }
    if (object.kind?.length ?? 0 > 0) {
      return <VscCircle className="text-blue-500" size={16} />;
    }
    return <LuSquare className="text-blue-600" size={16} />;
  };

  const formatValue = () => {
    if (object.kind === "module") {
      return (
        <span className="text-purple-600">
          {object?.repr}
          {object?.value_type && (
            <>
              :{" "}
              <span className="font-bold text-amber-600">
                {" "}
                {object?.value_type}
              </span>
            </>
          )}
        </span>
      );
    }
    return (
      <span className="text-teal-600">
        {object?.repr}
        {object?.value_type && (
          <>
            :{" "}
            <span className="font-bold text-amber-600">
              {" "}
              {object?.value_type}
            </span>
          </>
        )}
      </span>
    );
  };

  const hasChildren = object.children?.length ?? 0 > 0;

  // Render children
  const renderChildren = () => {
    if (!hasChildren || !isOpen) return null;
    return object.children!.map(([slotName, child]) => (
      <ObjectTreeNode
        key={slotName}
        slotName={slotName}
        slotPath={`${slotPath}/${slotName}`}
        struct={struct}
        id={child}
        depth={depth + 1}
        open_objects={open_objects}
        toggleOpenObject={toggleOpenObject}
      />
    ));
  };

  const indent = "";

  return (
    <div className={""}>
      <div
        className={`flex items-center py-1 ${indent} ${isRoot ? "bg-gray-100 p-2 hover:bg-gray-300" : "hover:bg-gray-50"}`}
      >
        {hasChildren ? (
          <button
            onClick={() => toggleOpenObject(slotPath)}
            className="mr-1 focus:outline-none"
          >
            {isOpen ? (
              <LuChevronDown size={16} />
            ) : (
              <LuChevronRight size={16} />
            )}
          </button>
        ) : (
          <span className="mr-1 w-4"></span>
        )}
        {getIcon()}
        <span className={`mx-1 font-mono ${isRoot ? "" : ""}`}>
          <span className={`${isRoot ? "text-blue-800" : "text-blue-800"}`}>
            {slotName}
          </span>
          {": "}
          {formatValue()}
        </span>
      </div>
      <div className="ml-4">{renderChildren()}</div>
    </div>
  );
};

export default ObjectTreeNode;
