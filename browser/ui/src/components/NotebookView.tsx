import React from "react";
import ResizableColumns from "./ResizibleColumns";
import EditorPanel from "./EditorPanel";
import RunTabs from "./RunTabs";

const NotebookView: React.FC = () => {
  return (
    <div className="">
      <ResizableColumns
        leftContent={<EditorPanel />}
        rightContent={<RunTabs />}
        initialLeftWidth={50}
        minWidth={20}
      />
    </div>
  );
};

export default NotebookView;
