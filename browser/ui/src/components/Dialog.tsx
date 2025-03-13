import React, { useEffect, useRef, useState } from "react";
import { LuX } from "react-icons/lu";
import { DialogConfig } from "../core/state";
import { useDispatch } from "./StateProvider";

interface ModalProps {
  config: DialogConfig;
}

const ModalDialog: React.FC<ModalProps> = ({ config }) => {
  const [inputValue, setInputValue] = useState(config?.value);
  const dispatch = useDispatch()!;
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
    }
  }, [ref]);

  const handleConfirm = () => {
    config.onConfirm(inputValue!);
    setInputValue("");
    dispatch({
      type: "set_dialog",
      dialog: null,
    });
  };

  const handleCancel = () => {
    config.onCancel();
    setInputValue("");
    dispatch({
      type: "set_dialog",
      dialog: null,
    });
  };

  const isDisabled = inputValue.length == 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-md w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4">
          <h2 className="text-xl font-bold">{config.title}</h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label="Close"
          >
            <LuX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <input
            ref={ref}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter text here..."
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            disabled={isDisabled}
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-md ${isDisabled ? "bg-gray-300" : "bg-blue-600 hover:bg-blue-700"} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            {config.okText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDialog;
