import React, { useCallback } from "react";
import { EditorCell } from "../core/notebook";
import { useGlobalState, useDispatch } from "./StateProvider";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-python";
import "prismjs/themes/prism.css";
import { useSendCommand } from "./WsProvider";
import { newEdtorCell, runCell, saveNotebook } from "../core/actions";
import { SquarePlus, Save, Loader2 } from "lucide-react";
import { usePushNotification } from "./NotificationProvider";

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
  const notebook = state.selected_notebook!;
  const pushNotification = usePushNotification();
  return (
    <div
      className={`border-l-6 pl-1 ${notebook.selected_editor_cell_id == cell.id ? "border-blue-200" : "border-white"}`}
    >
      <div className="mb-2 border border-gray-400 rounded-md overflow-hidden">
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
              id: cell.id,
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

const EditorPanel: React.FC = () => {
  const state = useGlobalState();
  const dispatch = useDispatch()!;
  const notebook = state.selected_notebook!;
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
        {notebook.editor_cells.map((cell, index) => (
          <EditorCellRenderer
            key={cell.id}
            cell={cell}
            prev_id={notebook.editor_cells[index - 1]?.id || null}
            next_id={notebook.editor_cells[index + 1]?.id || null}
          />
        ))}
      </div>
    </div>
  );
};

export default EditorPanel;
