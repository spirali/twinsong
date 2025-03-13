import { LuLoaderCircle } from "react-icons/lu";

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 flex flex-col items-center justify-center min-h-screen">
      <div className="flex flex-col items-center space-y-4">
        <LuLoaderCircle className="h-12 w-12 animate-spin text-blue-500" />
        <div className="flex flex-col items-center space-y-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Loading...
          </h2>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
