import { JSX, useState } from "react";
import NotebookList from "./DirList";
import { useDispatch, useGlobalState } from "./StateProvider";
import NotebookView from "./NotebookView";
import { NotebookTabs } from "lucide-react";

const TabButton = (props: {
  highlighted: boolean;
  label: JSX.Element;
  border: boolean;
  onClick: () => void;
}) => {
  const border = props.border ? "border-b-2 border-blue-500" : "";
  return (
    <button
      className={`
      px-6 py-2 text-sm font-medium
      ${
        props.highlighted
          ? border + " text-blue-600 bg-gray-300"
          : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }
      text-center focus:outline-none transition-colors
    `}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
};

const GlobalTabs = () => {
  const state = useGlobalState();
  const dispatch = useDispatch()!;
  const [showNotebookList, setShowNotebookList] = useState<boolean>(true);

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="w-full border-b border-gray-200 bg-white">
        <div className="pl-4 flex">
          <div className="pr-4">
            <TabButton
              border={false}
              highlighted={showNotebookList}
              label={<NotebookTabs />}
              onClick={() => setShowNotebookList(!showNotebookList)}
            />
          </div>
          {state.notebooks.map((notebook) => (
            <TabButton
              key={notebook.id}
              border={true}
              highlighted={notebook.id === state.selected_notebook?.id}
              label={<>{notebook.path}</>}
              onClick={() =>
                dispatch({ type: "set_selected_notebook", id: notebook.id })
              }
            />
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex h-full">
        {showNotebookList && <NotebookList />}
        {state.selected_notebook === null ? null : <NotebookView />}
      </div>
    </div>
  );
};

export default GlobalTabs;
