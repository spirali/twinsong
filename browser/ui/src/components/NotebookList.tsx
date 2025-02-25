import { SquarePlus } from "lucide-react";
import { useSendCommand } from "./WsProvider";

const NotebookList = () => {
  const sendCommand = useSendCommand()!;
  return (
    <button
      onClick={() => {
        sendCommand({ type: "CreateNewNotebook" });
      }}
      className="bg-gray-100 text-black px-4 py-2 rounded hover:bg-gray-200"
    >
      <div className="flex items-center">
        <SquarePlus className="w-4 h-4 mr-2" />
        Add notebook
      </div>
    </button>
  );
};

export default NotebookList;
