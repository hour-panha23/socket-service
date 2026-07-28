"use client";

import { Sidebar } from "@/src/components/Sidebar";
import { SocketProvider, useSocketContext } from "@/src/context/SocketContext";
import QueryProvider from "@/src/providers/query-provider";
import { Geist, Geist_Mono } from "next/font/google";
import { usePathname, useRouter } from "next/navigation";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
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
    <div className="flex bg-slate-950 h-screen overflow-hidden font-sans text-slate-100 antialiased">
      <Sidebar
        activeTab={activeTab}
        isConnected={isConnected}
        setActiveTab={handleTabChange}
      />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-full" suppressHydrationWarning>
        <QueryProvider>
          <SocketProvider>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
          </SocketProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
