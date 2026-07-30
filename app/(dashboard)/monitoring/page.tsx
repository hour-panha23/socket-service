"use client";

import { RealtimeMonitor } from "@/src/components/RealtimeMonitor";
import { useSocketContext } from "@/src/context/SocketContext";

export default function MonitoringPage() {
  const socketState = useSocketContext();

  return <RealtimeMonitor {...socketState} />;
}
