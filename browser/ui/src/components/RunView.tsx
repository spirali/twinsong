import { Run } from "../core/notebook";
import OutputCell from "./OutputCell";
import { StatusIndicator } from "./StatusIndicator";

const RunView: React.FC<{ run: Run }> = (props: { run: Run }) => {
  return (
    <div className="overflow-auto" style={{ height: "calc(100vh - 150px)" }}>
      {props.run.output_cells.map((cell, index) => (
        <OutputCell key={cell.id} cell={cell} isLast={index === props.run.output_cells.length - 1} />
      ))}
    </div>
  );
};

export default RunView;
