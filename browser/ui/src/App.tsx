import "./App.css";
import GlobalTabs from "./components/GlobalTabs";
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
          {/*<NotebookView />*/}
          <GlobalTabs />
        </WsProvider>
      </StateProvider>
    </NotificationProvider>
  );
}

export default App;
