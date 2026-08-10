"use client";

import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FolderKanban,
  Zap,
} from "lucide-react";
import React, { useState } from "react";

interface SidebarProps {
  activeTab: "monitoring" | "project" | "device";
  setActiveTab: (tab: "monitoring" | "project" | "device") => void;
  isConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      id: "monitoring" as const,
      label: "Realtime Monitor",
      icon: Activity,
    },
    {
      id: "project" as const,
      label: "Project Management",
      icon: FolderKanban,
    },
    {
      id: "device" as const,
      label: "Device Management",
      icon: Cpu,
    },
  ];

  return (
    <aside
      className={`relative z-20 flex flex-col justify-between bg-slate-900/90 backdrop-blur-xl border-slate-800/80 border-r shrink-0 transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? "w-20 p-3" : "w-64 p-4"
      }`}
    >
      <div className="space-y-6">
        {/* Header / Brand */}
        <div
          className={`flex items-center ${
            isCollapsed ? "justify-center" : "justify-between px-1"
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex justify-center items-center bg-linear-to-tr from-indigo-600 to-indigo-500 shadow-indigo-600/25 shadow-lg rounded-xl w-9 h-9 text-white shrink-0">
              <Zap className="fill-white w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <h1 className="font-bold text-white text-sm truncate tracking-tight">
                  Socket Center
                </h1>
                <span className="font-mono text-[10px] text-slate-400 truncate">
                  v1.2.0 • Gateway
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="hover:bg-slate-800/80 p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="space-y-2">
          {!isCollapsed && (
            <p className="px-3 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
              Navigation
            </p>
          )}

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isCollapsed ? "justify-center px-0" : ""
                  } ${
                    isActive
                      ? "bg-indigo-600/15 text-indigo-300 font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  {/* Left Accent Indicator Pill */}
                  {isActive && (
                    <span className="top-2 bottom-2 left-0 absolute bg-indigo-500 rounded-r-full w-1" />
                  )}

                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive
                        ? "text-indigo-400"
                        : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />

                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Area: Socket Connection & Expand Toggle */}
      <div className="space-y-3 pt-4 border-slate-800/80 border-t">
        {/* Connection Status Badge */}
        <div
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/60 ${
            isCollapsed ? "justify-center px-0" : ""
          }`}
          title={
            isConnected
              ? "Gateway Socket Connected"
              : "Gateway Socket Disconnected"
          }
        >
          <span className="relative flex w-2 h-2 shrink-0">
            {isConnected && (
              <span className="top-0 left-0 absolute bg-emerald-400 rounded-full w-2 h-2 animate-ping" />
            )}
            <span
              className={`relative inline-flex rounded-full w-2 h-2 ${
                isConnected ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          </span>

          {!isCollapsed && (
            <span className="font-mono text-[11px] text-slate-300 truncate">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          )}
        </div>

        {/* Expand Toggle Button (Shown when collapsed) */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex justify-center items-center hover:bg-slate-800 p-2 rounded-xl w-full text-slate-400 hover:text-white transition cursor-pointer"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
