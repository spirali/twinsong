import React from "react";
import { Loader2, CheckCircle, Activity, X } from "lucide-react";
import { KernelState } from "../core/notebook";

interface StatusIndicatorProps {
  status: KernelState;
  message: string | null;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
}) => {
  const statusConfig = {
    init: {
      color: "bg-yellow-300",
      textColor: "text-yellow-700",
      icon: <Loader2 className="w-4 h-4 mr-2 animate-spin" />,
      label: "Initializing kernel",
    },
    ready: {
      color: "bg-green-300",
      textColor: "text-green-700",
      icon: <CheckCircle className="w-4 h-4 mr-2" />,
      label: "Kernel is ready",
    },
    running: null,
    // running: {
    //   color: 'bg-blue-300',
    //   textColor: 'text-blue-700',
    //   icon: <Activity className="w-4 h-4 mr-2 animate-pulse" />,
    //   label: 'Running'
    // },
    crashed: {
      color: "bg-red-300",
      textColor: "text-red-700",
      icon: <X className="w-4 h-4 mr-2" />,
      label: "Kernel crashed",
    },
    closed: {
      color: "bg-gray-300",
      textColor: "text-gray-700",
      icon: <X className="w-4 h-4 mr-2" />,
      label: "Kernel closed",
    },
  };
  const config = statusConfig[status];
  if (config === null) {
    return <></>;
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
