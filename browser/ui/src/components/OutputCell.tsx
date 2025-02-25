import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle, Clock, PlayCircle } from "lucide-react";
import { OutputCell, OutputValue } from "../core/notebook";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-python";
import { useGlobalState } from "./StateProvider";

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

const OutputCellView: React.FC<{ cell: OutputCell }> = (props: {
  cell: OutputCell;
}) => {
  const state = useGlobalState();
  const notebook = state.selected_notebook!;
  const [showMetadata, setShowMetadata] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [ref]);

  // Get the appropriate icon based on status
  const getStatusIcon = () => {
    switch (props.cell.status) {
      case "pending":
        return <Clock className="h-4 w-4 text-blue-700" />;
      case "running":
        return <PlayCircle className="h-4 w-4 text-yellow-700" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-700" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-700" />;
      default:
        return null;
    }
  };

  // Get status text with appropriate color
  const getStatusText = () => {
    switch (props.cell.status) {
      case "pending":
        return <span className="text-blue-700 text-xs">Pending</span>;
      case "running":
        return <span className="text-yellow-700 text-xs">Running</span>;
      case "success":
        return <span className="text-green-700 text-xs">Done</span>;
      case "error":
        return <span className="text-red-700 text-xs">Error</span>;
      default:
        return null;
    }
  };

  return (
    <div
      className={`border-l-6 pl-1 ${notebook.selected_editor_cell_id == props.cell.editor_cell.id ? "border-orange-200" : "border-white"}`}
    >
      <div ref={ref} className="border border-gray-300 shadow-sm mb-2 mr-6">
        {/* Smaller Status Bar */}
        <div
          className={`flex items-center justify-between px-1 py-1 border-b border-gray-300 ${props.cell.status === "running" ? "bg-yellow-50" : "bg-gray-50"}`}
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
          <div className="bg-gray-50 border-b text-sm border-gray-300">
            <Editor
              value={props.cell.editor_cell.value}
              highlight={(code) => highlight(code, languages.python)}
              padding={5}
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 12,
              }}
              onValueChange={() => {}}
            />
          </div>
        )}

        {/* Content */}
        <div
          className={`p-1 ${props.cell.status === "error" ? "bg-red-50" : ""}`}
        >
          {props.cell.values.map((value, index) => (
            <OutputValueView key={index} value={value} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OutputCellView;
