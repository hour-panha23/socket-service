"use client";

import { Sidebar } from "@/src/components/Sidebar";
import { SocketProvider, useSocketContext } from "@/src/context/SocketContext";
import QueryProvider from "@/src/providers/query-provider";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";

function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected } = useSocketContext();
  const activeTab = pathname.includes("/project")
    ? "project"
    : pathname.includes("/device")
      ? "device"
      : "monitoring";

  const handleTabChange = (tab: "monitoring" | "project" | "device") => {
    router.push(
      tab === "monitoring"
        ? "/monitoring"
        : tab === "project"
          ? "/project"
          : "/device",
    );
  };

  return (
    <div className="flex bg-slate-950 min-h-screen text-white">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isConnected={isConnected}
      />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SocketProvider>
        <DashboardShell>{children}</DashboardShell>
      </SocketProvider>
    </QueryProvider>
  );
}
