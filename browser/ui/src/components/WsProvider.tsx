import { createContext, JSX, useContext, useEffect, useState } from "react";
import { processMessage, SendCommand, ToClientMessage } from "../core/messages";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { SendJsonMessage } from "react-use-websocket/dist/lib/types";
import { useDispatch } from "./StateProvider";
import ErrorScreen from "./ErrorScreen";

const WsContext = createContext<SendJsonMessage | null>(null);

export const WsProvider = (props: { children: JSX.Element }) => {
  const [error, setError] = useState<string | null>(null);
  const WS_URL = "ws://127.0.0.1:4500/ws";
  //    const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch()!;
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(
    WS_URL,
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
      sendJsonMessage({
        type: "login",
      });
      sendJsonMessage({ type: "CreateNewNotebook" });
    }
  }, [readyState]);

  useEffect(() => {
    if (!lastJsonMessage) {
      return;
    }
    console.log("Got a new message: ", lastJsonMessage);
    let message = lastJsonMessage as ToClientMessage;
    processMessage(message, dispatch);
  }, [lastJsonMessage]);

  if (error !== null) {
    return <ErrorScreen title="Error" message={error} />;
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
