import React, { useState } from "react";
import { useDispatch, useGlobalState } from "./StateProvider";
import RunView from "./RunView";
import { Plus } from "lucide-react";
import twinsong_logo from "./twinsong.jpeg";
import { useSendCommand } from "./WsProvider";
import { newRun } from "../core/actions";

const RunTabs: React.FC = () => {
  const state = useGlobalState();
  const dispatch = useDispatch()!;
  const sendCommand = useSendCommand()!;

  return (
    <div className="flex flex-col h-full">
      {/* Content area */}

      <div className="flex justify-start bg-white">
        {state.notebook!.runs.map((run) => (
          <button
            key={run.id}
            onClick={() =>
              dispatch({ type: "set_current_run", run_id: run.id })
            }
            className={`py-2 px-5 text-sm font-medium transition-colors duration-200 
            ${
              run.id === state.current_run_id
                ? "bg-orange-100 text-orange-800 border-b-2"
                : "bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-700"
            }`}
          >
            {<span>{run.title}</span>}
          </button>
        ))}
        <button
          key=""
          onClick={() => {
            newRun(state, dispatch, sendCommand);
          }}
          className={`py-2 px-5 text-sm font-medium transition-colors duration-200 
             'bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-700'}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {state.current_run_id == null ? (
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
        <div className="flex-grow p-2 bg-white overflow-auto">
          <RunView
            run={
              state.notebook!.runs.find((r) => r.id === state.current_run_id)!
            }
          />
        </div>
      )}
    </div>
  );
};

export default RunTabs;
