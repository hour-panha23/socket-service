"use client";

import {
  Activity,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Zap,
} from "lucide-react";
import React, { useState } from "react";

interface SidebarProps {
  activeTab: "monitoring" | "project";
  setActiveTab: (tab: "monitoring" | "project") => void;
  isConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeClass =
    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 transition-all duration-150";
  const inactiveClass =
    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all duration-150";

  return (
    <aside
      className={`z-10 flex flex-col justify-between bg-slate-900/80 backdrop-blur-md border-slate-800/80 border-r shrink-0 transition-all duration-200 ${
        isCollapsed ? "w-16 p-3" : "w-64 p-4"
      }`}
    >
      <div className="space-y-6">
        {/* Header / Logo / Collapse Toggle */}
        <div
          className={`flex items-center ${
            isCollapsed ? "justify-center" : "justify-between px-1"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex justify-center items-center bg-indigo-600 shadow-indigo-500/30 shadow-lg rounded-lg w-8 h-8 font-bold text-white shrink-0">
              <Zap className="fill-white w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="font-bold text-white text-sm tracking-tight whitespace-nowrap">
                  Socket Center
                </h1>
                <p className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                  v1.2.0 • Gateway
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hover:bg-slate-800 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab("monitoring")}
            className={`${
              activeTab === "monitoring" ? activeClass : inactiveClass
            } ${isCollapsed ? "justify-center px-0" : ""}`}
            title="Realtime Monitor"
          >
            <Activity className="w-4 h-4 shrink-0" />
            {!isCollapsed && (
              <span className="whitespace-nowrap">Realtime Monitor</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("project")}
            className={`${
              activeTab === "project" ? activeClass : inactiveClass
            } ${isCollapsed ? "justify-center px-0" : ""}`}
            title="Project Management"
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            {!isCollapsed && (
              <span className="whitespace-nowrap">Project Management</span>
            )}
          </button>
        </nav>
      </div>

      {/* Footer / Status Badge */}
      <div className="pt-4 border-slate-800/60 border-t">
        <div
          className={`flex items-center bg-slate-950/50 border border-slate-800/50 rounded-lg ${
            isCollapsed ? "justify-center p-2.5" : "justify-between p-3"
          }`}
        >
          {!isCollapsed && (
            <span className="font-medium text-[11px] text-slate-400 whitespace-nowrap">
              Socket Status
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full text-[10px] font-semibold border ${
              isCollapsed ? "p-1.5" : "px-2.5 py-0.5"
            } ${
              isConnected
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
            title={isConnected ? "Connected" : "Disconnected"}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            {!isCollapsed && (isConnected ? "Connected" : "Disconnected")}
          </span>
        </div>
      </div>
    </aside>
  );
};
