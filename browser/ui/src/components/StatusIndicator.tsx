import React from "react";
import { LuLoaderCircle, LuX, LuCircle } from "react-icons/lu";
import { KernelState } from "../core/notebook";

interface StatusIndicatorProps {
  status: KernelState;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const statusConfig = {
    Init: {
      color: "bg-yellow-300",
      textColor: "text-yellow-700",
      icon: <LuLoaderCircle className="w-4 h-4 mr-2 animate-spin" />,
      label: "Initializing kernel",
    },
    Running: {
      color: "bg-green-300",
      textColor: "text-green-700",
      icon: <LuCircle fill="green" className="w-4 h-4 mr-2" />,
      label: "Online",
    },
    Crashed: {
      color: "bg-red-300",
      textColor: "text-red-700",
      icon: <LuX className="w-4 h-4 mr-2" />,
      label: "Kernel crashed",
    },
    Closed: {
      color: "bg-gray-300",
      textColor: "text-red-700",
      icon: <LuCircle className="w-4 h-4 mr-2" />,
      label: "Inactive",
    },
  };
  const config = statusConfig[status.type];
  if (!config) {
    return <></>;
  }
  let message = null;
  if (status.type === "Crashed") {
    message = status.message;
  }
  return (
    <div className={`flex items-center`}>
      <div className={`flex items-center ml-2 ${config.textColor}`}>
        {config.icon}
        <span className="font-medium">{config.label}</span>
        {message && <span className="text-xs ml-2">{message}</span>}
      </div>
    </div>
  );
};
