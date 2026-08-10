/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { buildAdminSignedAuth, buildSignedAuth } from "../lib/socket-auth";

export interface ConnectSocketParams {
  appId: string;
  secret: string;
  mode: "app" | "admin";
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [adminSubscribed, setAdminSubscribed] = useState(false);
  const [logs, setLogs] = useState<
    { time: string; msg: string; type: "info" | "warn" | "error" | "emit" }[]
  >([]);
  const [clientEvents, setClientEvents] = useState<any[]>([]);
  const [emitLogs, setEmitLogs] = useState<any[]>([]);
  const [connectedClientCount, setConnectedClientCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  const addLog = useCallback(
    (msg: string, type: "info" | "warn" | "error" | "emit" = "info") => {
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, { time, msg, type }]);
    },
    [],
  );

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setAdminSubscribed(false);
      addLog("Disconnected from socket server", "warn");
    }
  }, [addLog]);

  const connectSocket = useCallback(
    async ({ appId, secret, mode }: ConnectSocketParams) => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      addLog(`Signing auth payload for mode: ${mode}...`, "info");

      try {
        const authData =
          mode === "admin"
            ? await buildAdminSignedAuth(appId, secret)
            : await buildSignedAuth(appId, secret);

        const socketUrl =
          process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

        // Pass auth directly in auth payload (Standard for Socket.io NestJS Gateways)
        const socketInstance = io(socketUrl, {
          transports: ["websocket"],
          auth: authData,
        });

        socketInstance.on("connect", () => {
          setIsConnected(true);
          addLog(
            `Connected successfully! Socket ID: ${socketInstance.id}`,
            "info",
          );
        });

        socketInstance.on("connect_error", (err) => {
          setIsConnected(false);
          addLog(`Connection rejected: ${err.message}`, "error");
        });

        socketInstance.on("disconnect", (reason) => {
          setIsConnected(false);
          addLog(`Disconnected: ${reason}`, "warn");
        });

        socketInstance.on("telemetry:emit", (data) => {
          setEmitLogs((prev) => [data, ...prev]);
        });

        socketInstance.on("telemetry:client", (data) => {
          setClientEvents((prev) => [data, ...prev]);
          if (data.type === "connect") setConnectedClientCount((c) => c + 1);
          if (data.type === "disconnect")
            setConnectedClientCount((c) => Math.max(0, c - 1));
        });

        socketRef.current = socketInstance;
        setSocket(socketInstance);
      } catch (err: any) {
        addLog(`Failed to build signature: ${err.message}`, "error");
      }
    },
    [addLog],
  );

  const toggleAdmin = useCallback(() => {
    if (!socketRef.current || !isConnected) return;

    if (adminSubscribed) {
      socketRef.current.emit("admin:unsubscribe");
      setAdminSubscribed(false);
      addLog("Unsubscribed from admin feed", "warn");
    } else {
      socketRef.current.emit("admin:subscribe");
      setAdminSubscribed(true);
      addLog("Subscribed to admin telemetry feed", "info");
    }
  }, [isConnected, adminSubscribed, addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
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
  };
}
