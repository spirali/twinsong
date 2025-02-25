import "./App.css";
import GlobalTabs from "./components/GlobalTabs";
import NotebookView from "./components/NotebookView";
import { StateProvider } from "./components/StateProvider";
import { WsProvider } from "./components/WsProvider";

function App() {
  return (
    <StateProvider>
      <WsProvider>
        {/*<NotebookView />*/}
        <GlobalTabs/>
      </WsProvider>
    </StateProvider>
  );
}

export default App;
