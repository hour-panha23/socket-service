"use client";

import { RealtimeMonitor } from "@/src/components/RealtimeMonitor";
import { useSocket } from "@/src/hook/useSocket";

export default function MonitoringPage() {
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
    latency,
    autoReconnect,
    toggleAutoReconnect,
    lastDisconnectReason,
    reconnectAttempt,
  } = useSocket();

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
      latency={latency}
      autoReconnect={autoReconnect}
      toggleAutoReconnect={toggleAutoReconnect}
      lastDisconnectReason={lastDisconnectReason}
      reconnectAttempt={reconnectAttempt}
    />
  );
}
