import { NotebookId, Run } from "../core/notebook";
import ObjectTreeNode from "./ObjectTreeNode";
import { useDispatch } from "./StateProvider";

const Workspace: React.FC<{ notebook_id: NotebookId; run: Run }> = ({
  notebook_id,
  run,
}) => {
  const dispatch = useDispatch()!;
  const toggleOpenObject = (object_path: string) => {
    dispatch({
      type: "toggle_open_object",
      notebook_id: notebook_id,
      run_id: run.id,
      object_path,
    });
  };
  return (
    <div className="overflow-auto" style={{ height: "calc(100vh - 150px)" }}>
      {run.globals.map(([key, struct]) => (
        <ObjectTreeNode
          key={key}
          struct={struct}
          id={struct.root}
          slotName={key}
          depth={0}
          isRoot={true}
          slotPath={key}
          open_objects={run.open_objects}
          toggleOpenObject={toggleOpenObject}
        />
      ))}
    </div>
  );
};

export default Workspace;
