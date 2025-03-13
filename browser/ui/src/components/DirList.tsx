import { LuFolder, LuFile, LuSquarePlus, LuFileCog } from "react-icons/lu";
import { useSendCommand } from "./WsProvider";
import { useDispatch, useGlobalState } from "./StateProvider";
import { loadNotebook } from "../core/actions";

const getIcon = (type: string) => {
  switch (type) {
    case "LoadedNotebook":
      return <LuFileCog size={16} className="text-green-600" />;
    case "Notebook":
      return <LuFileCog size={16} className="text-orange-600" />;
    case "Dir":
      return <LuFolder size={16} className="text-gray-600" />;
    default:
      return <LuFile size={16} className="text-gray-500" />;
  }
};

const getColor = (type: string) => {
  switch (type) {
    case "LoadedNotebook":
      return "text-green-600";
    case "Notebook":
      return "text-orange-600";
    default:
      return "text-gray-500";
  }
};

const NotebookList = () => {
  const state = useGlobalState();
  const sendCommand = useSendCommand()!;
  const dispatch = useDispatch()!;

  const entries = state.dir_entries.filter(
    (entry) => !entry.path.startsWith("."),
  );
  entries.sort(
    (a, b) =>
      (a.entry_type === "Dir" ? 0 : 1) - (b.entry_type === "Dir" ? 0 : 1),
  );

  return (
    <div className="w-80 bg-gray-100 h-full">
      <button
        onClick={() => {
          sendCommand({ type: "CreateNewNotebook" });
        }}
        className="bg-gray-100 text-black px-4 py-2 rounded hover:bg-gray-200"
      >
        <div className="flex items-center">
          <LuSquarePlus className="w-4 h-4 mr-2" />
          Add notebook
        </div>
      </button>
      <div
        className="flex-grow h-full overflow-hidden max-w-md bg-white rounded-md shadow border border-gray-200"
        style={{ height: "calc(100% - 78px)" }}
      >
        <ul className="divide-y divide-gray-100 h-full overflow-auto cursor-pointer">
          {entries.map((entry) => {
            const bg =
              entry.path === state.selected_notebook?.path
                ? "bg-gray-300 "
                : "hover:bg-gray-50";
            return (
              <li
                key={entry.path}
                className={"p-2 " + bg}
                onClick={() => {
                  if (
                    entry.entry_type === "Notebook" ||
                    entry.entry_type === "LoadedNotebook"
                  ) {
                    loadNotebook(state, entry.path, dispatch, sendCommand);
                  }
                }}
              >
                <div className="flex items-center space-x-3">
                  {getIcon(entry.entry_type)}
                  <p
                    className={
                      "text-sm font-medium text-gray-900 truncate " +
                      getColor(entry.entry_type)
                    }
                  >
                    {entry.path}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default NotebookList;
