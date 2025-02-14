import React from "react";
import ResizableColumns from "./ResizibleColumns";
import EditorPanel from "./EditorPanel";
import LoadingScreen from "./LoadingScreen";
import { useGlobalState } from "./StateProvider";
import RunTabs from "./RunTabs";


const NotebookView: React.FC = () => {
  const state = useGlobalState();
    
  if (state.notebook === null) {
    return <LoadingScreen/>
  }

  return (
    <div className="">
      <ResizableColumns
        leftContent={<EditorPanel />}
        rightContent={<RunTabs/>}
        initialLeftWidth={50}
        minWidth={20}
      />
    </div>
  );
}

export default NotebookView;