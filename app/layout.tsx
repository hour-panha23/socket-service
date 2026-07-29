"use client";

import { Sidebar } from "@/src/components/Sidebar";
import { SocketProvider, useSocketContext } from "@/src/context/SocketContext";
import QueryProvider from "@/src/providers/query-provider";
import { Geist, Geist_Mono } from "next/font/google";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function DashboardLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected } = useSocketContext();

  const activeTab = pathname.includes("/apps") ? "apps" : "monitoring";

  const handleTabChange = (tab: "monitoring" | "apps") => {
    if (tab === "monitoring") {
      router.push("/monitoring");
    } else if (tab === "apps") {
      router.push("/apps");
    }
  };

  return (
    <div
      className={`flex min-h-screen ${geistSans.variable} ${geistMono.variable} font-sans bg-slate-950 text-white`}
    >
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isConnected={isConnected}
      />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className="bg-slate-950 text-white antialiased"
        suppressHydrationWarning
      >
        <QueryProvider>
          <SocketProvider>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
          </SocketProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
