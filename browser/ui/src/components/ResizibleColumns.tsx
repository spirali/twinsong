import React, { useState, useEffect, useCallback } from "react";

interface Props {
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  initialLeftWidth?: number;
  minWidth?: number;
}

const ResizableColumns: React.FC<Props> = ({
  leftContent = "Left Column",
  rightContent = "Right Column",
  initialLeftWidth = 50,
  minWidth = 20,
}) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const container = document.getElementById("resizable-container");
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newLeftWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Ensure the width stays within bounds
      if (newLeftWidth >= minWidth && newLeftWidth <= 100 - minWidth) {
        setLeftWidth(newLeftWidth);
      }
    },
    [isDragging, minWidth],
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="w-full h-full">
      <div id="resizable-container" className="flex w-full h-full">
        {/* Left Column */}
        <div
          className="h-full overflow-auto"
          style={{ width: `${leftWidth}%` }}
        >
          <div className="h-full">{leftContent}</div>
        </div>

        {/* Resizer */}
        <div
          className="w-1 bg-gray-200 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors"
          onMouseDown={handleMouseDown}
        />

        {/* Right Column */}
        <div
          style={{ width: `${100 - leftWidth}%` }}
        >
          <div className="h-full">{rightContent}</div>
        </div>
      </div>
    </div>
  );
};

export default ResizableColumns;
