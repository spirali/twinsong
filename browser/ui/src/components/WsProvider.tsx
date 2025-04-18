import { createContext, JSX, useContext, useEffect, useState } from "react";
import { processMessage, SendCommand, ToClientMessage } from "../core/messages";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { SendJsonMessage } from "react-use-websocket/dist/lib/types";
import { useDispatch } from "./StateProvider";
import ErrorScreen from "./ErrorScreen";
import LoadingScreen from "./LoadingScreen";
import { usePushNotification } from "./NotificationProvider";
import Cookies from "js-cookie";

const WsContext = createContext<SendJsonMessage | null>(null);

declare global {
  interface Window {
    SERVER_URL: string;
  }
}

export const WsProvider = (props: { children: JSX.Element }) => {
  const pushNotification = usePushNotification();
  const [error, setError] = useState<string | null>(null);
  //    const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch()!;
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(
    window.SERVER_URL,
    {
      share: false,
      shouldReconnect: () => false,
    },
  );

  useEffect(() => {
    console.log("Connection state changed", readyState);
    if (readyState === ReadyState.CLOSED) {
      setError("Connection lost");
    }
    if (readyState === ReadyState.OPEN) {
      const authToken = Cookies.get("authToken");
      sendJsonMessage({
        token: authToken,
      });
      sendJsonMessage({
        type: "QueryDir",
      });
    }
  }, [readyState]);

  useEffect(() => {
    if (!lastJsonMessage) {
      return;
    }
    console.log("Got a new message: ", lastJsonMessage);
    let message = lastJsonMessage as ToClientMessage;
    processMessage(message, dispatch, pushNotification);
  }, [lastJsonMessage]);

  if (error !== null) {
    return <ErrorScreen title="Error" message={error} />;
  }

  if (readyState !== ReadyState.OPEN) {
    return <LoadingScreen />;
  }

  return (
    <WsContext.Provider value={sendJsonMessage}>
      {props.children}
    </WsContext.Provider>
  );
};

export function useSendCommand(): SendCommand | null {
  return useContext(WsContext);
}
