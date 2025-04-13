import { useEffect, useState } from "react";
import "./App.css";
import GlobalTabs from "./components/GlobalTabs";
import {
  NotificationProvider,
  Notifications,
} from "./components/NotificationProvider";
import { StateProvider } from "./components/StateProvider";
import { WsProvider } from "./components/WsProvider";
import Cookies from "js-cookie";

function App() {
  const [tokenChecked, setTokenChecked] = useState<boolean>(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("k");
    if (token) {
      Cookies.set("authToken", token, { path: "/", sameSite: "strict" });
      window.location.href = window.location.origin;
    }
    setTokenChecked(true);
  }, []);

  return (
    tokenChecked && (
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
    )
  );
}

export default App;
