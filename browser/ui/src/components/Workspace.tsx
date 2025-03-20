import { LuChevronDown, LuChevronRight, LuGlobe } from "react-icons/lu";
import { Globals, NotebookId, Run } from "../core/notebook";
import ObjectTreeNode from "./ObjectTreeNode";
import { useDispatch } from "./StateProvider";

const Scope: React.FC<{
  slotPath: string;
  globals: Globals;
  openObjects: Set<string>;
  toggleOpenObject: (path: string) => void;
}> = ({ globals, slotPath, openObjects, toggleOpenObject }) => {
  return (
    <>
      {globals.children.map(([id, scope]) => {
        const hasChildren = scope.children.length + scope.variables.length > 0;
        const childSlotPath = slotPath + "/" + id;
        const isOpen = openObjects.has(childSlotPath);
        return (
          <div key={id}>
            <div className={`flex items-center py-1 "hover:bg-gray-50"}`}>
              {hasChildren ? (
                <button
                  onClick={() => toggleOpenObject(childSlotPath)}
                  className="mr-1 focus:outline-none"
                >
                  {isOpen ? (
                    <LuChevronDown size={16} />
                  ) : (
                    <LuChevronRight size={16} />
                  )}
                </button>
              ) : (
                <span className="mr-1 w-4"></span>
              )}
              <LuGlobe size={16} className="text-purple-400" />
              <span className="mx-1 font-mono text-blue-800">{scope.name}</span>
            </div>
            {isOpen && (
              <div className="ml-4">
                <Scope
                  slotPath={childSlotPath}
                  globals={scope}
                  openObjects={openObjects}
                  toggleOpenObject={toggleOpenObject}
                />
              </div>
            )}
          </div>
        );
      })}
      {globals.variables.map(([name, struct]) => (
        <ObjectTreeNode
          key={name}
          struct={struct}
          id={struct.root}
          slotName={name}
          depth={0}
          slotPath={slotPath + ":" + name}
          openObjects={openObjects}
          toggleOpenObject={toggleOpenObject}
        />
      ))}
    </>
  );
};

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
      <Scope
        globals={run.globals}
        slotPath=""
        openObjects={run.open_objects}
        toggleOpenObject={toggleOpenObject}
      />
    </div>
  );
};

export default Workspace;
