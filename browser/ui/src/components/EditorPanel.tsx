import React, { useState } from 'react';
import { EditorCell } from '../core/notebook';
import { useGlobalState, useDispatch } from './StateProvider';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism.css'; //Example style, you can use another
import { useSendCommand } from './WsProvider';
import { run_cell } from '../core/actions';
import { SquarePlus } from 'lucide-react';

const EditorCellRenderer: React.FC<{
  cell: EditorCell;
}> = ({ cell }) => {
  const dispatch = useDispatch()!;
  const sendCommand = useSendCommand()!;
  const state = useGlobalState();

  return (
    <div className="mb-2 border border-gray-200 rounded-md overflow-hidden">
      <Editor
        value={cell.value}
        onValueChange={code => { dispatch({ type: "cell_edit", id: cell.id, value: code }) }}
        highlight={code => highlight(code, languages.python)}
        padding={10}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 12,
        }}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            run_cell(cell, state, dispatch, sendCommand);
          } 
        }
      }
      />
    </div>
  );
};

const EditorPanel: React.FC = () => {
  let state = useGlobalState();
    
  return (
    <div className="h-full">
      {/* Toolbar */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex space-x-2">
          <button
            onClick={() => { }}
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
        {state.notebook!.editor_cells.map((cell) => (
          <EditorCellRenderer
            key={cell.id}
            cell={cell}
          />
        ))}
      </div>
    </div>
  );
};

export default EditorPanel;
