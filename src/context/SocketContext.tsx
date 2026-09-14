/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { resolveSocketUrl } from "@/src/lib/get-socket-url";
import { buildAdminSignedAuth, buildSignedAuth } from "@/src/lib/socket-auth";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

export interface LogEntry {
  time: string;
  msg: string;
  type: "info" | "warn" | "error" | "emit";
}

export interface ClientEvent {
  type: "connect" | "disconnect";
  clientId: string;
  appId?: string;
  timestamp: string;
}

export interface EmitLog {
  event: string;
  rawEvent: string;
  recipientCount: number;
  scope: string;
  target: string;
  payload?: any;
  timestamp?: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  adminSubscribed: boolean;
  logs: LogEntry[];
  clientEvents: ClientEvent[];
  emitLogs: EmitLog[];
  connectedClientCount: number;
  connectSocket: (params: {
    appId: string;
    secret: string;
    mode: "app" | "admin";
  }) => void;
  disconnectSocket: () => void;
  toggleAdmin: () => void;
  clearLogs: () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [adminSubscribed, setAdminSubscribed] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clientEvents, setClientEvents] = useState<ClientEvent[]>([]);
  const [emitLogs, setEmitLogs] = useState<EmitLog[]>([]);
  const [connectedClientCount, setConnectedClientCount] = useState<number>(0);

  const socketRef = useRef<Socket | null>(null);

  const addLog = (
    msg: string,
    type: "info" | "warn" | "error" | "emit" = "info",
  ) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, msg, type }]);
  };

  const connectSocket = async ({
    appId,
    secret,
    mode,
  }: {
    appId: string;
    secret: string;
    mode: "app" | "admin";
  }) => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    const socketUrl = await resolveSocketUrl();

    const newSocket = io(`${socketUrl}/notifications`, {
      transports: ["websocket"],
      autoConnect: true,
      auth: async (cb) => {
        try {
          const authPayload =
            mode === "admin"
              ? await buildAdminSignedAuth(appId, secret)
              : await buildSignedAuth(appId, secret);
          cb(authPayload);
        } catch (err) {
          addLog(
            `Failed to sign handshake: ${(err as Error).message}`,
            "error",
          );
          cb({});
        }
      },
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
      addLog(`Connected to Gateway (Socket ID: ${newSocket.id})`, "info");
    });

    newSocket.on("disconnect", (reason) => {
      setIsConnected(false);
      setAdminSubscribed(false);
      addLog(`Disconnected from Gateway: ${reason}`, "warn");
    });

    newSocket.on("connect_error", (err) => {
      setIsConnected(false);
      addLog(`Authentication Rejected: ${err.message}`, "error");
    });

    newSocket.on("admin:emit_log", (entry: EmitLog) => {
      setEmitLogs((prev) => [entry, ...prev]);
      addLog(
        `[Emit] "${entry.event}" (raw: "${entry.rawEvent}") -> ${entry.recipientCount} client(s) (${entry.scope}:${entry.target})`,
        "info",
      );
    });

    newSocket.on(
      "admin:room_event",
      (event: {
        type: "join" | "leave";
        clientId: string;
        appId?: string;
        rooms: string[];
        timestamp: string;
      }) => {
        addLog(
          `[Room ${event.type.toUpperCase()}] ${event.clientId} → ${event.rooms.join(", ")}`,
          "info",
        );
      },
    );

    newSocket.on("admin:client_event", (event: ClientEvent) => {
      setClientEvents((prev) => [event, ...prev]);
      setConnectedClientCount((prev) =>
        event.type === "connect" ? prev + 1 : Math.max(0, prev - 1),
      );
      addLog(
        `[Client ${event.type.toUpperCase()}] ID: ${event.clientId}`,
        event.type === "connect" ? "info" : "warn",
      );
    });

    newSocket.on("learning_hub.notification", (payload: any) => {
      addLog(
        `[Emit Received] room:${payload.room ?? "unknown"} → ${JSON.stringify(payload.data ?? payload)}`,
        "emit",
      );
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setAdminSubscribed(false);
      addLog("Manual socket disconnect executed", "warn");
    }
  };

  useEffect(() => {
    if (!socket) return;

    const onAdminSubscribed = () => {
      setAdminSubscribed(true);
      addLog("Admin feed subscription activated", "info");
    };
    const onAdminUnsubscribed = () => {
      setAdminSubscribed(false);
      addLog("Admin feed unsubscribed", "info");
    };

    socket.on("admin:subscribed", onAdminSubscribed);
    socket.on("admin:unsubscribed", onAdminUnsubscribed);

    return () => {
      socket.off("admin:subscribed", onAdminSubscribed);
      socket.off("admin:unsubscribed", onAdminUnsubscribed);
    };
  }, [socket]);

  const toggleAdmin = () => {
    if (!socketRef.current || !isConnected) {
      return alert("Connect socket first!");
    }

    const action = adminSubscribed ? "admin:unsubscribe" : "admin:subscribe";

    socketRef.current.emit(action, undefined, (res: any) => {
      if (res?.event === "admin:subscribed") {
        setAdminSubscribed(true);
        addLog("Admin feed subscription activated", "info");
      } else if (res?.event === "admin:unsubscribed") {
        setAdminSubscribed(false);
        addLog("Admin feed unsubscribed", "info");
      } else {
        addLog(`Unexpected admin response: ${JSON.stringify(res)}`, "warn");
      }
    });
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        adminSubscribed,
        logs,
        clientEvents,
        emitLogs,
        connectedClientCount,
        connectSocket,
        disconnectSocket,
        toggleAdmin,
        clearLogs: () => setLogs([]),
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (!context)
    throw new Error("useSocketContext must be used within a SocketProvider");
  return context;
};
