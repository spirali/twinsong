import React from "react";
import ResizableColumns from "./ResizibleColumns";
import EditorPanel from "./EditorPanel";
import RunTabs from "./RunTabs";
import { Notebook } from "../core/notebook";

const NotebookView: React.FC<{ notebook: Notebook }> = (props: {
  notebook: Notebook;
}) => {
  return (
    <div className="w-full p-2">
      <ResizableColumns
        leftContent={<EditorPanel notebook={props.notebook} />}
        rightContent={<RunTabs notebook={props.notebook} />}
        initialLeftWidth={50}
        minWidth={20}
      />
    </div>
  );
};

export default NotebookView;
