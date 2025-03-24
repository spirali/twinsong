import React, { useEffect, useRef, useState } from "react";
import {
  LuCircleAlert,
  LuCircleCheck,
  LuClock,
  LuCirclePlay,
} from "react-icons/lu";
import { EditorNode, OutputCell, OutputValue } from "../core/notebook";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-python";
import { useGlobalState } from "./StateProvider";

const CodeTree: React.FC<{ node: EditorNode; depth: number }> = ({
  node,
  depth,
}) => {
  if (node.type === "Cell") {
    return (
      <Editor
        className={`${depth > 0 ? "border" : ""} mb-2 bt-1 border-gray-400 rounded`}
        value={node.code}
        highlight={(code) => highlight(code, languages.python)}
        padding={5}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 12,
        }}
        onValueChange={() => {}}
      />
    );
  } else if (node.type === "Group") {
    return (
      <div>
        <div className="flex">{node.name}</div>
        <div className="ml-2">
          {node.children.map((child) => (
            <CodeTree key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }
};

const OutputValueView: React.FC<{ value: OutputValue }> = (props: {
  value: OutputValue;
}) => {
  const value = props.value;
  if (value.type === "None") {
    return null;
  }
  if (value.type === "Text") {
    return <pre className="text-left">{value.value}</pre>;
  } else if (value.type === "Html") {
    return <div dangerouslySetInnerHTML={{ __html: value.value }} />;
  } else if (value.type === "Exception") {
    return (
      <pre className="text-left">
        {value.value.message + "\n" + value.value.traceback}
      </pre>
    );
  }
  return null;
};

const OutputCellView: React.FC<{
  cell: OutputCell;
  isLast: boolean;
}> = (props: { cell: OutputCell; isLast: boolean }) => {
  const state = useGlobalState();
  const notebook = state.selected_notebook!;
  const [showMetadata, setShowMetadata] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && props.isLast) {
      ref.current.scrollIntoView({ behavior: "instant" });
    }
  }, [props.cell.values]);

  // Get the appropriate icon based on status
  const getStatusIcon = () => {
    switch (props.cell.flag) {
      case "Pending":
        return <LuClock className="h-4 w-4 text-blue-700" />;
      case "Running":
        return <LuCirclePlay className="h-4 w-4 text-yellow-700" />;
      case "Success":
        return <LuCircleCheck className="h-4 w-4 text-green-700" />;
      case "Fail":
        return <LuCircleAlert className="h-4 w-4 text-red-700" />;
      default:
        return null;
    }
  };

  // Get status text with appropriate color
  const getStatusText = () => {
    switch (props.cell.flag) {
      case "Pending":
        return <span className="text-blue-700 text-xs">Pending</span>;
      case "Running":
        return <span className="text-yellow-700 text-xs">Running</span>;
      case "Success":
        return <span className="text-green-700 text-xs">Done</span>;
      case "Fail":
        return <span className="text-red-700 text-xs">Error</span>;
      default:
        return null;
    }
  };

  return (
    <div
      className={`border-l-6 pl-1 ${notebook.selected_editor_node_id === props.cell.called_id ? "border-orange-200" : "border-white"}`}
    >
      <div ref={ref} className="border border-gray-300 shadow-sm mb-2 mr-6">
        {/* Smaller Status Bar */}
        <div
          className={`flex items-center justify-between px-1 py-1 border-b border-gray-300 ${props.cell.flag === "Running" ? "bg-yellow-50" : "bg-gray-50"}`}
        >
          <div className="flex items-center space-x-1">
            {getStatusIcon()}
            {getStatusText()}
          </div>
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="flex items-center justify-center px-2 py-1 bg-gray-200 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
            aria-label="Toggle metadata"
          >
            {/*<Info className="h-3 w-3 text-gray-600 mr-1" />*/}
            <span>Code</span>
          </button>
        </div>

        {/* Metadata (conditionally rendered) */}
        {showMetadata && (
          <div className="bg-gray-50 border-b text-sm border-gray-300 p-1">
            <CodeTree node={props.cell.editor_node} depth={0} />
          </div>
        )}

        {/* Content */}
        <div className={`p-1 ${props.cell.flag === "Fail" ? "bg-red-50" : ""}`}>
          {props.cell.values.map((value, index) => (
            <OutputValueView key={index} value={value} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OutputCellView;
