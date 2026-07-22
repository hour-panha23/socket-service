"use client";

import { MoreVertical } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ActionMenuProps {
  app: {
    id: string;
    is_active: boolean;
  };
  onToggleActive: (id: string, active: boolean) => void;
  onRegenerateSecret: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  app,
  onToggleActive,
  onRegenerateSecret,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Position portal dropdown directly below trigger button
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 144, // 144px width (w-36) alignment to right
      });
    }
    setIsOpen((prev) => !prev);
  };

  // Close on window scroll or resize
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => setIsOpen(false);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="hover:bg-slate-800 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition"
        aria-label="Actions menu"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen &&
        typeof window !== "undefined" &&
        createPortal(
          <>
            {/* Backdrop for click-outside close */}
            <div
              className="z-50 fixed inset-0"
              onClick={() => setIsOpen(false)}
            />

            {/* Portal Dropdown Menu */}
            <div
              style={{
                top: `${coords.top}px`,
                left: `${coords.left}px`,
              }}
              className="z-60 absolute space-y-1 bg-slate-900 shadow-2xl p-1 border border-slate-800 rounded-lg w-36 text-xs text-left"
            >
              <button
                onClick={() => {
                  setIsOpen(false);
                  onToggleActive(app.id, !app.is_active);
                }}
                className={`w-full text-left px-3 py-1.5 rounded-md font-medium transition ${
                  app.is_active
                    ? "text-amber-400 hover:bg-amber-500/10"
                    : "text-emerald-400 hover:bg-emerald-500/10"
                }`}
              >
                {app.is_active ? "Disable" : "Enable"}
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  if (
                    confirm(
                      "This invalidates the current secret key immediately. Continue?",
                    )
                  ) {
                    onRegenerateSecret(app.id);
                  }
                }}
                className="hover:bg-slate-800 px-3 py-1.5 rounded-md w-full font-medium text-indigo-300 text-left transition"
              >
                Regenerate Key
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  if (confirm("Delete this app permanently?")) {
                    onDelete(app.id);
                  }
                }}
                className="hover:bg-rose-500/10 px-3 py-1.5 rounded-md w-full font-medium text-rose-400 text-left transition"
              >
                Delete App
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
};
