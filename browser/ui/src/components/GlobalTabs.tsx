import React, { JSX, useState } from "react";
import NotebookList from "./NotebookList";
import { useDispatch, useGlobalState } from "./StateProvider";
import { NotebookId } from "../core/notebook";
import NotebookView from "./NotebookView";
import { NotebookTabs, Loader2 } from "lucide-react";

const TabButton = (props: {
  id: NotebookId | null;
  selectedId: NotebookId | null;
  label: JSX.Element;
}) => {
  const dispatch = useDispatch()!;
  return (
    <button
      className={`
      px-6 py-2 text-sm font-medium 
      ${
        props.id === props.selectedId
          ? "border-b-2 border-blue-500 text-blue-600 bg-gray-300"
          : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }
      text-center focus:outline-none transition-colors
    `}
      onClick={() => dispatch({ type: "set_selected_notebook", id: props.id })}
    >
      {props.label}
    </button>
  );
};

const GlobalTabs = () => {
  const state = useGlobalState();

  return (
    <div className="w-screen fixed left-0 top-0">
      {/* Tab Navigation */}
      <div className="w-full border-b border-gray-200 bg-white">
        <div className="pl-4 flex">
          <TabButton
            id={null}
            selectedId={state.selected_notebook?.id || null}
            label={<NotebookTabs />}
          />
          {state.notebooks.map((notebook) => (
            <TabButton
              key={notebook.id}
              id={notebook.id}
              selectedId={state.selected_notebook?.id || null}
              label={<>{notebook.path}</>}
            />
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 bg-white">
        {state.selected_notebook === null ? <NotebookList /> : <NotebookView />}
      </div>
    </div>
  );
};

export default GlobalTabs;
