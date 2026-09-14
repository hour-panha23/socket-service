/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { resolveSocketUrl } from "../lib/get-socket-url";
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

  // --- New: connection health / control state ---
  const [latency, setLatency] = useState<number | null>(null);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [lastDisconnectReason, setLastDisconnectReason] = useState<
    string | null
  >(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const pingStartRef = useRef<number>(0);
  const autoReconnectRef = useRef(autoReconnect);
  // eslint-disable-next-line react-hooks/refs
  autoReconnectRef.current = autoReconnect;

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
      setLatency(null);
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

        const socketUrl = await resolveSocketUrl();

        // Gateway is declared with `namespace: '/notifications'` — must connect
        // to that path explicitly, connecting to the root '/' bypasses all
        // auth/logic registered on the gateway.
        const socketInstance = io(`${socketUrl}/notifications`, {
          transports: ["websocket"],
          auth: authData,
          reconnection: autoReconnectRef.current,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        socketInstance.on("connect", () => {
          setIsConnected(true);
          setReconnectAttempt(0);
          setLastDisconnectReason(null);
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
          setLatency(null);
          setLastDisconnectReason(reason);
          addLog(`Disconnected: ${reason}`, "warn");
        });

        // --- Reconnection lifecycle (Manager-level events) ---
        socketInstance.io.on("reconnect_attempt", (attempt: number) => {
          setReconnectAttempt(attempt);
          addLog(`Reconnect attempt #${attempt}...`, "warn");
        });

        socketInstance.io.on("reconnect", (attempt: number) => {
          setIsConnected(true);
          setReconnectAttempt(0);
          addLog(`Reconnected after ${attempt} attempt(s)`, "info");
        });

        socketInstance.io.on("reconnect_failed", () => {
          addLog("Reconnect failed — giving up", "error");
        });

        socketInstance.io.on("reconnect_error", (err: any) => {
          addLog(`Reconnect error: ${err?.message ?? err}`, "error");
        });

        // --- Latency: measured off the raw engine.io ping/pong heartbeat,
        // no custom server handler required. Client sends "ping", server
        // replies "pong" automatically every pingInterval. ---
        socketInstance.io.on("open", () => {
          const engine = (socketInstance.io as any).engine;
          if (!engine) return;

          engine.on("packetCreate", (packet: any) => {
            if (packet.type === "ping") {
              pingStartRef.current = Date.now();
            }
          });

          engine.on("packet", (packet: any) => {
            if (packet.type === "pong" && pingStartRef.current) {
              setLatency(Date.now() - pingStartRef.current);
            }
          });
        });

        socketInstance.on("admin:emit_log", (data) => {
          setEmitLogs((prev) => [data, ...prev]);
        });

        socketInstance.on("admin:client_event", (data) => {
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

  const toggleAutoReconnect = useCallback(() => {
    setAutoReconnect((prev) => {
      const next = !prev;
      if (socketRef.current?.io) {
        socketRef.current.io.reconnection(next);
      }
      addLog(
        next ? "Auto-reconnect enabled" : "Auto-reconnect disabled",
        "info",
      );
      return next;
    });
  }, [addLog]);

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
    // new
    latency,
    autoReconnect,
    toggleAutoReconnect,
    lastDisconnectReason,
    reconnectAttempt,
  };
}
