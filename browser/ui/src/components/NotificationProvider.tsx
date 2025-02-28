// NotificationContext.tsx
import React, { createContext, useContext, useState, useCallback } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";

// Define types
export type NotificationType = "error" | "success";

type Message = {
  id: string;
  text: string;
  type: NotificationType;
  createdAt: number;
};

type NotificationContextType = {
  messages: Message[];
  pushMessage: (text: string, type: NotificationType) => void;
  removeMessage: (id: string) => void;
};

// Create context
const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

// Provider props
type NotificationProviderProps = {
  children: React.ReactNode;
  autoCloseTime?: number;
};

// Provider component
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  autoCloseTime = 3000,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const pushMessage = useCallback(
    (text: string, type: NotificationType) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        text,
        type,
        createdAt: Date.now(),
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);

      // Auto-remove after specified time
      setTimeout(() => {
        removeMessage(newMessage.id);
      }, autoCloseTime);
    },
    [autoCloseTime],
  );

  const removeMessage = useCallback((id: string) => {
    setMessages((prevMessages) =>
      prevMessages.filter((message) => message.id !== id),
    );
  }, []);

  return (
    <NotificationContext.Provider
      value={{ messages, pushMessage, removeMessage }}
    >
      {children}
      <NotificationOverlay />
    </NotificationContext.Provider>
  );
};


export type PushNotification = ((
  text: string,
  type: NotificationType,
) => void)

export const usePushNotification = (): PushNotification => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "usePushMessage must be used within a NotificationProvider",
    );
  }
  return context.pushMessage;
};

// NotificationOverlay component
const NotificationOverlay: React.FC = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "NotificationOverlay must be used within a NotificationProvider",
    );
  }

  const { messages, removeMessage } = context;

  if (messages.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {messages.map((message) => {
        const isError = message.type === "error";
        const bgColor = isError ? "bg-red-500" : "bg-green-500";
        const Icon = isError ? AlertCircle : CheckCircle;

        return (
          <div
            key={message.id}
            className={`${bgColor} text-white p-4 rounded-md shadow-lg flex items-start`}
            role="alert"
          >
            <Icon size={20} className="mr-2 flex-shrink-0" />
            <div className="flex-grow mr-2">{message.text}</div>
            <button
              onClick={() => removeMessage(message.id)}
              className="text-white hover:text-gray-100 focus:outline-none"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

// Export the reusable component for explicit use if needed
export const Notifications = NotificationOverlay;
