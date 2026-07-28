"use client";

import { RealtimeMonitor } from "@/src/components/RealtimeMonitor";
import { useSocketContext } from "@/src/context/SocketContext";

export default function SocketCenterPage() {
  const {
    socket,
    isConnected,
    adminSubscribed,
    connectSocket,
    disconnectSocket,
    toggleAdmin,
    logs,
    clearLogs,
    clientEvents,
    emitLogs,
    connectedClientCount,
  } = useSocketContext();

  return (
    <RealtimeMonitor
      socket={socket}
      isConnected={isConnected}
      adminSubscribed={adminSubscribed}
      connectSocket={connectSocket}
      disconnectSocket={disconnectSocket}
      toggleAdmin={toggleAdmin}
      logs={logs}
      clearLogs={clearLogs}
      clientEvents={clientEvents}
      emitLogs={emitLogs}
      connectedClientCount={connectedClientCount}
    />
  );
}
