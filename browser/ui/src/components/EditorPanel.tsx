import React, { useState } from "react";
import { EditorCell } from "../core/notebook";
import { useGlobalState, useDispatch } from "./StateProvider";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-python";
import "prismjs/themes/prism.css";
import { useSendCommand } from "./WsProvider";
import { newEdtorCell, runCell } from "../core/actions";
import { SquarePlus } from "lucide-react";

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

const EditorCellRenderer: React.FC<{
  cell: EditorCell;
  prev_id: string | null;
  next_id: string | null;
}> = ({ cell, prev_id, next_id }) => {
  const dispatch = useDispatch()!;
  const sendCommand = useSendCommand()!;
  const state = useGlobalState();

  return (
    <div className="mb-2 border border-gray-200 rounded-md overflow-hidden">
      <Editor
        id={cell.id}
        value={cell.value}
        onValueChange={(code) => {
          dispatch({ type: "cell_edit", id: cell.id, value: code });
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
            runCell(cell, state, dispatch, sendCommand);
          }
          if (e.key == "ArrowUp" && prev_id && checkIfFirstLine(e)) {
            e.preventDefault();
            let textArea = document
              .getElementById(prev_id)
              ?.getElementsByTagName("textarea")[0];
            if (textArea) {
              textArea.focus();
              textArea.setSelectionRange(
                textArea.value.length,
                textArea.value.length,
              );
            }
          }
          if (e.key == "ArrowDown" && next_id && checkIfLastLine(e)) {
            e.preventDefault();
            let textArea = document
              .getElementById(next_id)
              ?.getElementsByTagName("textarea")[0];
            if (textArea) {
              textArea.focus();
              textArea.setSelectionRange(0, 0);
            }
          }
        }}
      />
    </div>
  );
};

const EditorPanel: React.FC = () => {
  let state = useGlobalState();
  let dispatch = useDispatch()!;

  return (
    <div className="h-full">
      {/* Toolbar */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex space-x-2">
          <button
            onClick={() => {
              newEdtorCell(dispatch);
            }}
            className="bg-gray-100 text-black px-4 py-2 rounded hover:bg-gray-200"
          >
            <div className="flex items-center">
              <SquarePlus className="w-4 h-4 mr-2" /> Add code cell
            </div>
          </button>
        </div>
      </div>

      {/* Cells Container */}
      <div className="p-4 space-y-4 overflow-auto">
        {state.notebook!.editor_cells.map((cell, index) => (
          <EditorCellRenderer
            key={cell.id}
            cell={cell}
            prev_id={state.notebook!.editor_cells[index - 1]?.id || null}
            next_id={state.notebook!.editor_cells[index + 1]?.id || null}
          />
        ))}
      </div>
    </div>
  );
};

export default EditorPanel;
