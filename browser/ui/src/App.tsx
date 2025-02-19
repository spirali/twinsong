import "./App.css";
import NotebookView from "./components/NotebookView";
import { NotebookProvider } from "./components/StateProvider";
import { WsProvider } from "./components/WsProvider";

function App() {
  return (
    <NotebookProvider>
      <WsProvider>
        <NotebookView />
      </WsProvider>
    </NotebookProvider>
  );
}

export default App;
