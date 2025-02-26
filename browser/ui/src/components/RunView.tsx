import { Run } from "../core/notebook";
import OutputCell from "./OutputCell";
import { StatusIndicator } from "./StatusIndicator";

const RunView: React.FC<{ run: Run }> = (props: { run: Run }) => {
  return (
    <div>
      {(props.run.kernel_state.type !== "Running" ||
        props.run.output_cells.length === 0) && (
        <StatusIndicator status={props.run.kernel_state} />
      )}
      {props.run.output_cells.map((cell) => (
        <OutputCell key={cell.id} cell={cell} />
      ))}
    </div>
  );
};

export default RunView;
