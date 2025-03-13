import { LuBan, LuSquare } from "react-icons/lu";
import { ReactNode, useEffect, useRef, useState } from "react";
import { TbRowInsertBottom, TbRowInsertTop } from "react-icons/tb";
import { PiTreeView } from "react-icons/pi";

type Icon = "ban" | "square" | "insert_above" | "insert_below" | "insert_child";

export interface MenuItem {
  icon: Icon;
  title: string;
  onClick: () => void;
}

function getIcon(name: Icon): ReactNode {
  switch (name) {
    case "ban":
      return <LuBan size={18} className="mr-2" />;
    case "square":
      return <LuSquare size={18} className="mr-2" />;
    case "insert_above":
      return <TbRowInsertTop size={18} className="mr-2" />;
    case "insert_below":
      return <TbRowInsertBottom size={18} className="mr-2" />;
    case "insert_child":
      return <PiTreeView size={18} className="mr-2" />;
  }
}

export const PopupMenu = (props: {
  createButton: (f: () => void) => ReactNode;
  items: MenuItem[];
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      event.preventDefault();
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={menuRef}>
      {props.createButton(toggleMenu)}
      {isOpen && (
        <div className="absolute right-0 w-64 mt-2 origin-top-right bg-white border border-gray-200 divide-y divide-gray-100 rounded-md shadow-lg z-100">
          {props.items.map((e, i) => (
            <div
              key={i}
              className="py-1"
              onClick={() => {
                e.onClick();
                setIsOpen(false);
              }}
            >
              <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900">
                {getIcon(e.icon)}
                {e.title}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
