import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "./StateProvider";
import RunView from "./RunView";
import { Ban, ListTree, MessageSquare, Plus, Square, X } from "lucide-react";
import { useSendCommand } from "./WsProvider";
import { closeRun, newRun } from "../core/actions";
import { Notebook, Run } from "../core/notebook";
import Workspace from "./Workspace";
import { StatusIndicator } from "./StatusIndicator";
import { Menu } from "lucide-react";
import { PopupMenu } from "./PopupMenu";

const RunMenu = () => (
  <PopupMenu
    createButton={(toggleMenu) => (
      <button
        onClick={toggleMenu}
        className="flex items-center justify-center p-2 rounded-md hover:bg-gray-100 focus:outline-none"
        aria-label="Menu"
      >
        <Menu size={24} />
      </button>
    )}
    items={[
      {
        icon: "ban",
        title: "Interrupt computation",
        onClick: () => {},
      },
      {
        icon: "square",
        title: "Stop kernel",
        onClick: () => {},
      },
    ]}
  />
);

/*
  const isComputing = false;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleInterrupt = () => {};

  const handleStop = () => {};

  return (
    <div className="relative" ref={menuRef}>


      {isOpen && (
        <div className="absolute right-0 w-64 mt-2 origin-top-right bg-white border border-gray-200 divide-y divide-gray-100 rounded-md shadow-lg z-10">
          <div className="py-1">
            <button
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              onClick={handleInterrupt}
              disabled={!isComputing}
            >
              <Ban size={18} className="mr-2" />
              Interrupt computation
            </button>
            <button
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              onClick={handleStop}
              disabled={!isComputing}
            >
              <Square size={18} className="mr-2" />
              Stop kernel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};*/

const TabCloseButton: React.FC<{
  onClick: (event: React.MouseEvent) => void;
}> = ({ onClick }) => {
  return (
    <button
      className="p-1 rounded-full text-orange-800 hover:text-orange-700 hover:bg-orange-200"
      onClick={onClick}
      aria-label="Close tab"
    >
      <X size={16} />
    </button>
  );
};

const ViewSwitch: React.FC<{ notebook: Notebook; run: Run }> = (props: {
  notebook: Notebook;
  run: Run;
}) => {
  const dispatch = useDispatch()!;
  const view_mode = props.run.view_mode;

  return (
    <div className="inline-flex rounded-md shadow-sm">
      <label
        className={`inline-flex items-center px-3 py-1 text-sm font-medium border rounded-l-md cursor-pointer ${
          view_mode === "outputs"
            ? "bg-orange-50 text-orange-700 border-orange-500 z-10"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        <input
          type="radio"
          className="sr-only"
          name="view-option"
          value="outputs"
          checked={view_mode === "outputs"}
          onChange={() =>
            dispatch({
              type: "set_run_view_mode",
              notebook_id: props.notebook.id,
              run_id: props.run.id,
              view_mode: "outputs",
            })
          }
        />
        <MessageSquare className="w-4 h-4 mr-1" />
        <span>Outputs</span>
      </label>

      <label
        className={`inline-flex items-center px-3 py-1 text-sm font-medium border rounded-r-md cursor-pointer ${
          view_mode === "workspace"
            ? "bg-orange-50 text-orange-700 border-orange-500 z-10"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        <input
          type="radio"
          className="sr-only"
          name="view-option"
          value="workspace"
          checked={view_mode === "workspace"}
          onChange={() =>
            dispatch({
              type: "set_run_view_mode",
              notebook_id: props.notebook.id,
              run_id: props.run.id,
              view_mode: "workspace",
            })
          }
        />
        <ListTree className="w-4 h-4 mr-1" />
        <span>Workspace</span>
      </label>
    </div>
  );
};

const RunTabs: React.FC<{ notebook: Notebook }> = (props: {
  notebook: Notebook;
}) => {
  const dispatch = useDispatch()!;
  const sendCommand = useSendCommand()!;
  const notebook = props.notebook;
  const run = notebook.runs.find((r) => r.id === notebook.current_run_id)!;
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-start bg-white">
        {notebook.runs.map((r) => (
          <div
            key={r.id}
            onClick={() =>
              dispatch({
                type: "set_current_run",
                notebook_id: notebook.id,
                run_id: r.id,
              })
            }
            className={`select-none cursor-default flex items-center py-2 pl-5 pr-2 text-sm font-medium transition-colors duration-200
            ${
              r.id === notebook.current_run_id
                ? "bg-orange-100 text-orange-800 border-b-2"
                : "bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-700"
            }`}
          >
            {<span>{r.title}</span>}
            {r.id === notebook.current_run_id && (
              <span className="pl-2">
                <TabCloseButton
                  onClick={(ev: React.MouseEvent) => {
                    ev.stopPropagation();
                    closeRun(notebook.id, r.id, dispatch, sendCommand);
                  }}
                />
              </span>
            )}
          </div>
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
            <RunMenu />
            <ViewSwitch notebook={notebook} run={run} />
            <StatusIndicator status={run.kernel_state} />
            {/* {(run.kernel_state.type !== "Running" ||
              run.output_cells.length === 0) && (

              )} */}
          </div>
          {run.view_mode === "outputs" && <RunView run={run} />}
          {run.view_mode === "workspace" && (
            <Workspace notebook_id={notebook.id} run={run} />
          )}
        </div>
      )}
    </div>
  );
};

export default RunTabs;
