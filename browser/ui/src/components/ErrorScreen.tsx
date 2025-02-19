import React from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface ErrorScreenProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({
  title,
  message,
  onRetry = () => window.location.reload(),
}) => {
  return (
    <div
      className={`fixed inset-0 bg-white dark:bg-gray-900 flex flex-col items-center justify-center min-h-screen p-4`}
    >
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          <AlertCircle className="h-16 w-16 text-red-500" />

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {title}
            </h1>

            <p className="text-gray-500 dark:text-gray-400">{message}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <button
            onClick={onRetry}
            type="button"
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorScreen;
