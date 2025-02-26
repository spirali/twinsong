import "./App.css";
import GlobalTabs from "./components/GlobalTabs";
import NotebookList from "./components/DirList";
import NotebookView from "./components/NotebookView";
import {
  NotificationProvider,
  Notifications,
} from "./components/NotificationProvider";
import { StateProvider } from "./components/StateProvider";
import { WsProvider } from "./components/WsProvider";

function App() {
  return (
    <NotificationProvider>
      <Notifications />
      <StateProvider>
        <WsProvider>
          <div className="h-screen w-screen flex fixed top-0 left-0">
            <GlobalTabs />
          </div>
        </WsProvider>
      </StateProvider>
    </NotificationProvider>
  );
}

export default App;
