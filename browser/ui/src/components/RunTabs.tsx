import React, { useState } from "react";
import { useDispatch, useGlobalState } from "./StateProvider";
import RunView from "./RunView";
import { Laptop, ListTree, MessageSquare, Plus, Terminal } from "lucide-react";
import { useSendCommand } from "./WsProvider";
import { newRun } from "../core/actions";
import { Notebook, Run } from "../core/notebook";
import Workspace from "./Workspace";
import { StatusIndicator } from "./StatusIndicator";


const ViewSwitch: React.FC<{ notebook: Notebook, run: Run }> = (props: { notebook: Notebook, run: Run }) => {
  const dispatch = useDispatch()!;
  const view_mode = props.run.view_mode;
  
  return (
    <div className="inline-flex rounded-md shadow-sm">
      <label 
        className={`inline-flex items-center px-3 py-1 text-sm font-medium border rounded-l-md cursor-pointer ${
          view_mode === 'outputs' 
            ? 'bg-orange-50 text-orange-700 border-orange-500 z-10' 
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input
          type="radio"
          className="sr-only"
          name="view-option"
          value="outputs"
          checked={view_mode === 'outputs'}
          onChange={() => dispatch({ type: "set_run_view_mode", notebook_id: props.notebook.id, run_id: props.run.id, view_mode: 'outputs' })}
        />
        <MessageSquare className="w-4 h-4 mr-1" />
        <span>Outputs</span>
      </label>

      <label 
        className={`inline-flex items-center px-3 py-1 text-sm font-medium border rounded-r-md cursor-pointer ${
          view_mode === 'workspace' 
            ? 'bg-orange-50 text-orange-700 border-orange-500 z-10' 
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input
          type="radio"
          className="sr-only"
          name="view-option"
          value="workspace"
          checked={view_mode === 'workspace'}
          onChange={() => dispatch({ type: "set_run_view_mode", notebook_id: props.notebook.id, run_id: props.run.id, view_mode: 'workspace' })}
        />
        <ListTree className="w-4 h-4 mr-1" />
        <span>Workspace</span>
      </label>
    </div>
  );
};


const RunTabs: React.FC<{ notebook: Notebook }> = (props: { notebook: Notebook }) => {
  const dispatch = useDispatch()!;
  const sendCommand = useSendCommand()!;
  const notebook = props.notebook;
  const run = notebook.runs.find((r) => r.id === notebook.current_run_id)!;
  return (
    <div className="flex flex-col h-full">
      {/* Content area */}

      <div className="flex justify-start bg-white">
        {notebook.runs.map((run) => (
          <button
            key={run.id}
            onClick={() =>
              dispatch({
                type: "set_current_run",
                notebook_id: notebook.id,
                run_id: run.id,
              })
            }
            className={`py-2 px-5 text-sm font-medium transition-colors duration-200
            ${
              run.id === notebook.current_run_id
                ? "bg-orange-100 text-orange-800 border-b-2"
                : "bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-700"
            }`}
          >
            {<span>{run.title}</span>}
          </button>
        ))}
        <button
          key="new-run"
          onClick={() => {
            newRun(notebook, dispatch, sendCommand);
          }}
          className={`py-2 px-5 text-sm font-medium transition-colors duration-200
             'bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-700'}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {notebook.current_run_id == null ? (
        <div className="flex flex-col">
          <div className="p-6 bg-white">No runs</div>
          <div className="p-6 bg-white">
            Evalaute a cell to create a new run
          </div>
          <div className="p-4 flex justify-center">
            <img src="./twinsong.jpeg" width={200} alt="TwinSong logo" />
          </div>
        </div>
      ) : (
        <div className="flex-grow pl-1 pr-2 pt-2 pb-2 bg-white">
          <div className="mb-2 flex ml-2">
          <ViewSwitch notebook={notebook} run={run} />
          {(run.kernel_state.type !== "Running" ||
            run.output_cells.length === 0) && (
            <StatusIndicator status={run.kernel_state} />
          )}

          </div>
          {run.view_mode === 'outputs' && (
            <RunView
              run={run}
            />
          )}
          {run.view_mode === 'workspace' && (
            <Workspace
              notebook_id={notebook.id}
              run={run}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default RunTabs;
