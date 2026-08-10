/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { io, Socket } from "socket.io-client";

/**
 * Event catalog — kept in lockstep with notifications.gateway.ts.
 */
type ClientEmittableEvent =
  | "join_room"
  | "leave_room"
  | "join_user_channel"
  | "__custom";

type AdminEmittableEvent = "admin:subscribe" | "admin:unsubscribe" | "__custom";

interface RoomTarget {
  projectId: string;
  appId: string;
  roomId: string;
}

interface JoinedRoom extends RoomTarget {
  rooms: string[];
}

interface ClientInstance {
  id: string;
  name: string;
  socket: Socket | null;
  isConnected: boolean;
  joinedRooms: JoinedRoom[];
  logs: {
    time: string;
    msg: string;
    type: "info" | "warn" | "error" | "emit";
  }[];
}

interface ClientTelemetryEvent {
  type: "connect" | "disconnect";
  clientId: string;
  appId?: string;
  timestamp: string;
}

interface RoomTelemetryEvent {
  type: "join" | "leave";
  clientId: string;
  appId?: string;
  rooms: string[];
  timestamp: string;
}

const roomKey = (t: RoomTarget) => `${t.projectId}::${t.appId}::${t.roomId}`;

const hierarchicalRooms = (t: RoomTarget): string[] => {
  const projectRoom = `project:${t.projectId}`;
  const appRoom = `${projectRoom}:app:${t.appId}`;
  const specificRoom = `${appRoom}:room:${t.roomId}`;
  return [projectRoom, appRoom, specificRoom];
};

/**
 * Client helper to fetch signed auth from server-side route
 */
async function fetchSocketAuth(
  projectId: string,
  type: "admin" | "app",
): Promise<{ timestamp: number; signature: string }> {
  const res = await fetch("/api/socket-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, type }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to fetch socket auth signature");
  }

  return res.json();
}

export const RealtimeMonitor: React.FC = () => {
  // Admin Connection State
  const [adminSocket, setAdminSocket] = useState<Socket | null>(null);
  const [isAdminConnected, setIsAdminConnected] = useState(false);
  const [isAdminSubscribed, setIsAdminSubscribed] = useState(false);
  const [adminLogs, setAdminLogs] = useState<
    { time: string; msg: string; type: string }[]
  >([]);
  const [adminLatencyMs, setAdminLatencyMs] = useState<number | null>(null);

  // Telemetry Aggregation
  const [clientEvents, setClientEvents] = useState<ClientTelemetryEvent[]>([]);
  const [roomEvents, setRoomEvents] = useState<RoomTelemetryEvent[]>([]);

  // Simulated Client Workbench
  const [clients, setClients] = useState<ClientInstance[]>([
    {
      id: "client_1",
      name: "Client A",
      socket: null,
      isConnected: false,
      joinedRooms: [],
      logs: [],
    },
    {
      id: "client_2",
      name: "Client B",
      socket: null,
      isConnected: false,
      joinedRooms: [],
      logs: [],
    },
  ]);
  const [activeClientId, setActiveClientId] = useState<string>("client_1");
  const [clientLatencyMs, setClientLatencyMs] = useState<
    Record<string, number>
  >({});

  // Client handshake target
  const [connectProjectId, setConnectProjectId] = useState(
    "project_e4de70df23a96fdb",
  );
  const [connectAppId, setConnectAppId] = useState("learning_hub");

  // Client Event Console
  const [clientSelectedEvent, setClientSelectedEvent] =
    useState<ClientEmittableEvent>("join_room");
  const [targetProjectId, setTargetProjectId] = useState(
    "project_e4de70df23a96fdb",
  );
  const [targetAppId, setTargetAppId] = useState("learning_hub");
  const [targetRoomId, setTargetRoomId] = useState("course_101");
  const [targetUserId, setTargetUserId] = useState("");
  const [leaveRoomKey, setLeaveRoomKey] = useState("");
  const [clientCustomEventName, setClientCustomEventName] = useState("");
  const [clientCustomPayload, setClientCustomPayload] = useState("{}");
  const [clientEmitWithAck, setClientEmitWithAck] = useState(true);

  // Admin Event Console
  const [adminSelectedEvent, setAdminSelectedEvent] =
    useState<AdminEmittableEvent>("admin:subscribe");
  const [adminCustomEventName, setAdminCustomEventName] = useState("");
  const [adminCustomPayload, setAdminCustomPayload] = useState("{}");
  const [adminEmitWithAck, setAdminEmitWithAck] = useState(true);

  // Ad-hoc "watch" listeners
  const [adminWatchedEvents, setAdminWatchedEvents] = useState<string[]>([]);
  const [clientWatchedEvents, setClientWatchedEvents] = useState<
    Record<string, string[]>
  >({});
  const [watchEventInput, setWatchEventInput] = useState("");

  // Helpers
  const logAdmin = (msg: string, type = "info") => {
    const time = new Date().toLocaleTimeString();
    setAdminLogs((prev) => [{ time, msg, type }, ...prev]);
  };

  const logClient = (
    clientId: string,
    msg: string,
    type: "info" | "warn" | "error" | "emit" = "info",
  ) => {
    const time = new Date().toLocaleTimeString();
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? { ...c, logs: [{ time, msg, type }, ...c.logs] }
          : c,
      ),
    );
  };

  const parseJsonPayload = (raw: string): any | null => {
    const trimmed = raw.trim();
    if (trimmed === "") return {};
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      alert(`Invalid JSON payload: ${(err as Error).message}`);
      return null;
    }
  };

  const clearAdminLogs = () => setAdminLogs([]);
  const clearClientLogs = (clientId: string) =>
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, logs: [] } : c)),
    );

  const exportLogs = (
    filename: string,
    logs: { time: string; msg: string; type: string }[],
  ) => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const attachLatencyTracking = (
    sock: Socket,
    onLatency: (ms: number) => void,
  ) => {
    sock.io.engine?.on("packet", (packet: any) => {
      if (packet.type === "pong") {
        const rtt = Date.now() - (sock as any)._pingSentAt;
        if (!Number.isNaN(rtt)) onLatency(rtt);
      }
    });
    const interval = setInterval(() => {
      if (sock.connected) {
        (sock as any)._pingSentAt = Date.now();
        (sock.io.engine as any)?.emit("ping");
      }
    }, 5000);
    return interval;
  };

  // 1. ADMIN SOCKET CONTROLS
  const handleConnectAdmin = async () => {
    const projectId = "f16c73f0d22ead5d";
    let signed;
    try {
      signed = await fetchSocketAuth(projectId, "admin");
    } catch (err) {
      return alert((err as Error).message);
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    const sock = io(`${baseUrl}/notifications`, {
      transports: ["websocket"],
      auth: {
        project_id: projectId,
        timestamp: signed.timestamp,
        signature: signed.signature,
      },
    });

    sock.on("connect", () => {
      setIsAdminConnected(true);
      logAdmin(`Admin Socket Connected [ID: ${sock.id}]`, "info");

      sock.emit("admin:subscribe", {}, (response: any) => {
        if (response?.data?.status === "ok") {
          setIsAdminSubscribed(true);
          logAdmin("Subscribed to admin:monitor feed", "info");
        }
      });
    });

    sock.on("admin:client_event", (evt: ClientTelemetryEvent) => {
      setClientEvents((prev) => [evt, ...prev]);
      logAdmin(
        `Client ${evt.type.toUpperCase()}: ${evt.clientId} (App: ${evt.appId || "N/A"})`,
        evt.type === "connect" ? "info" : "warn",
      );
    });

    sock.on("admin:room_event", (evt: RoomTelemetryEvent) => {
      setRoomEvents((prev) => [evt, ...prev]);
      logAdmin(
        `Room ${evt.type.toUpperCase()}: Socket ${evt.clientId} -> ${JSON.stringify(evt.rooms)}`,
        "emit",
      );
    });

    sock.on("connect_error", (err) => {
      logAdmin(`Connect Error: ${err.message}`, "error");
    });

    sock.onAny((eventName, ...args) => {
      if (
        eventName === "admin:client_event" ||
        eventName === "admin:room_event"
      )
        return;
      logAdmin(`[RAW] ${eventName}: ${JSON.stringify(args)}`, "emit");
    });

    const pingInterval = attachLatencyTracking(sock, setAdminLatencyMs);

    sock.on("disconnect", () => {
      setIsAdminConnected(false);
      setIsAdminSubscribed(false);
      setAdminLatencyMs(null);
      setAdminWatchedEvents([]);
      clearInterval(pingInterval);
      logAdmin("Admin Socket Disconnected", "error");
    });

    setAdminSocket(sock);
  };

  const handleDisconnectAdmin = () => {
    adminSocket?.disconnect();
    setAdminSocket(null);
  };

  const handleAdminEmit = () => {
    if (!adminSocket || !isAdminConnected)
      return alert("Connect the admin socket first!");

    if (adminSelectedEvent === "__custom") {
      if (!adminCustomEventName.trim())
        return alert("Enter a custom event name.");
      const payload = parseJsonPayload(adminCustomPayload);
      if (payload === null) return;

      logAdmin(
        `[EMIT] ${adminCustomEventName}: ${JSON.stringify(payload)}`,
        "emit",
      );
      if (adminEmitWithAck) {
        adminSocket.emit(adminCustomEventName, payload, (ack: any) =>
          logAdmin(
            `[ACK] ${adminCustomEventName} -> ${JSON.stringify(ack)}`,
            "info",
          ),
        );
      } else {
        adminSocket.emit(adminCustomEventName, payload);
      }
      return;
    }

    logAdmin(`[EMIT] ${adminSelectedEvent}`, "emit");
    adminSocket.emit(adminSelectedEvent, {}, (ack: any) => {
      logAdmin(`[ACK] ${adminSelectedEvent} -> ${JSON.stringify(ack)}`, "info");
      if (
        adminSelectedEvent === "admin:subscribe" &&
        ack?.data?.status === "ok"
      ) {
        setIsAdminSubscribed(true);
      }
      if (
        adminSelectedEvent === "admin:unsubscribe" &&
        ack?.data?.status === "ok"
      ) {
        setIsAdminSubscribed(false);
      }
    });
  };

  const handleAdminAddWatch = () => {
    if (!adminSocket) return alert("Connect the admin socket first!");
    const evt = watchEventInput.trim();
    if (!evt || adminWatchedEvents.includes(evt)) return;
    adminSocket.on(evt, (...args: any[]) =>
      logAdmin(`[WATCH:${evt}] ${JSON.stringify(args)}`, "warn"),
    );
    setAdminWatchedEvents((prev) => [...prev, evt]);
    setWatchEventInput("");
  };

  const handleAdminRemoveWatch = (evt: string) => {
    adminSocket?.off(evt);
    setAdminWatchedEvents((prev) => prev.filter((e) => e !== evt));
  };

  // 2. SIMULATED CLIENT CONTROLS
  const handleAddClient = () => {
    const nextIdx = clients.length + 1;
    const newId = `client_${nextIdx}`;
    setClients((prev) => [
      ...prev,
      {
        id: newId,
        name: `Client ${String.fromCharCode(64 + nextIdx)}`,
        socket: null,
        isConnected: false,
        joinedRooms: [],
        logs: [],
      },
    ]);
  };

  const handleConnectClient = async (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client || client.socket) return;

    let signed;
    try {
      signed = await fetchSocketAuth(connectProjectId, "app");
    } catch (err) {
      return alert((err as Error).message);
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    const sock = io(`${baseUrl}/notifications`, {
      transports: ["websocket"],
      auth: {
        project_id: connectProjectId,
        app_id: connectAppId,
        timestamp: signed.timestamp,
        signature: signed.signature,
      },
    });

    sock.on("connect", () => {
      logClient(clientId, `Connected with Socket ID: ${sock.id}`, "info");
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, isConnected: true } : c)),
      );
    });

    sock.onAny((eventName, data) => {
      logClient(
        clientId,
        `Received Event [${eventName}]: ${JSON.stringify(data)}`,
        "emit",
      );
    });

    sock.on("connect_error", (err) => {
      logClient(clientId, `Connect Error: ${err.message}`, "error");
    });

    const pingInterval = attachLatencyTracking(sock, (ms) =>
      setClientLatencyMs((prev) => ({ ...prev, [clientId]: ms })),
    );

    sock.on("disconnect", () => {
      clearInterval(pingInterval);
      setClientLatencyMs((prev) => {
        const next = { ...prev };
        delete next[clientId];
        return next;
      });
      setClientWatchedEvents((prev) => ({ ...prev, [clientId]: [] }));
      logClient(clientId, "Disconnected", "error");
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? { ...c, isConnected: false, socket: null, joinedRooms: [] }
            : c,
        ),
      );
    });

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, socket: sock } : c)),
    );
  };

  const handleDisconnectClient = (clientId: string) => {
    clients.find((c) => c.id === clientId)?.socket?.disconnect();
  };

  const handleClientEmit = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client?.socket || !client.isConnected)
      return alert("Connect this client socket first!");

    if (clientSelectedEvent === "join_room") {
      const target: RoomTarget = {
        projectId: targetProjectId.trim(),
        appId: targetAppId.trim(),
        roomId: targetRoomId.trim(),
      };
      if (!target.projectId || !target.appId || !target.roomId) {
        return alert("Project ID, App ID, and Room ID are all required.");
      }
      logClient(clientId, `[EMIT] join_room ${JSON.stringify(target)}`, "emit");
      client.socket.emit("join_room", target, (ack: any) => {
        logClient(
          clientId,
          `[ACK] join_room -> ${JSON.stringify(ack)}`,
          "info",
        );
        if (ack?.event === "room_joined") {
          const key = roomKey(target);
          setClients((prev) =>
            prev.map((c) => {
              if (c.id !== clientId) return c;
              if (c.joinedRooms.some((r) => roomKey(r) === key)) return c;
              return {
                ...c,
                joinedRooms: [
                  ...c.joinedRooms,
                  { ...target, rooms: hierarchicalRooms(target) },
                ],
              };
            }),
          );
        }
      });
      return;
    }

    if (clientSelectedEvent === "leave_room") {
      const target = client.joinedRooms.find(
        (r) => roomKey(r) === leaveRoomKey,
      );
      if (!target) return alert("Select a joined room to leave.");
      const dto: RoomTarget = {
        projectId: target.projectId,
        appId: target.appId,
        roomId: target.roomId,
      };
      logClient(clientId, `[EMIT] leave_room ${JSON.stringify(dto)}`, "emit");
      client.socket.emit("leave_room", dto, (ack: any) => {
        logClient(
          clientId,
          `[ACK] leave_room -> ${JSON.stringify(ack)}`,
          "info",
        );
        if (ack?.event === "room_left") {
          setClients((prev) =>
            prev.map((c) =>
              c.id !== clientId
                ? c
                : {
                    ...c,
                    joinedRooms: c.joinedRooms.filter(
                      (r) => roomKey(r) !== leaveRoomKey,
                    ),
                  },
            ),
          );
          setLeaveRoomKey("");
        }
      });
      return;
    }

    if (clientSelectedEvent === "join_user_channel") {
      if (!targetUserId.trim()) return alert("Enter a User ID.");
      logClient(
        clientId,
        `[EMIT] join_user_channel {"userId":"${targetUserId}"}`,
        "emit",
      );
      client.socket.emit(
        "join_user_channel",
        { userId: targetUserId.trim() },
        (ack: any) =>
          logClient(
            clientId,
            `[ACK] join_user_channel -> ${JSON.stringify(ack)}`,
            "info",
          ),
      );
      return;
    }

    if (!clientCustomEventName.trim())
      return alert("Enter a custom event name.");
    const payload = parseJsonPayload(clientCustomPayload);
    if (payload === null) return;

    logClient(
      clientId,
      `[EMIT] ${clientCustomEventName}: ${JSON.stringify(payload)}`,
      "emit",
    );
    if (clientEmitWithAck) {
      client.socket.emit(clientCustomEventName, payload, (ack: any) =>
        logClient(
          clientId,
          `[ACK] ${clientCustomEventName} -> ${JSON.stringify(ack)}`,
          "info",
        ),
      );
    } else {
      client.socket.emit(clientCustomEventName, payload);
    }
  };

  const handleQuickLeaveRoom = (clientId: string, target: JoinedRoom) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client?.socket || !client.isConnected) return;
    const dto: RoomTarget = {
      projectId: target.projectId,
      appId: target.appId,
      roomId: target.roomId,
    };
    logClient(clientId, `[EMIT] leave_room ${JSON.stringify(dto)}`, "emit");
    client.socket.emit("leave_room", dto, (ack: any) => {
      logClient(clientId, `[ACK] leave_room -> ${JSON.stringify(ack)}`, "info");
      if (ack?.event === "room_left") {
        setClients((prev) =>
          prev.map((c) =>
            c.id !== clientId
              ? c
              : {
                  ...c,
                  joinedRooms: c.joinedRooms.filter(
                    (r) => roomKey(r) !== roomKey(target),
                  ),
                },
          ),
        );
      }
    });
  };

  const handleClientAddWatch = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client?.socket) return alert("Connect this client socket first!");
    const evt = watchEventInput.trim();
    const existing = clientWatchedEvents[clientId] || [];
    if (!evt || existing.includes(evt)) return;
    client.socket.on(evt, (...args: any[]) =>
      logClient(clientId, `[WATCH:${evt}] ${JSON.stringify(args)}`, "warn"),
    );
    setClientWatchedEvents((prev) => ({
      ...prev,
      [clientId]: [...(prev[clientId] || []), evt],
    }));
    setWatchEventInput("");
  };

  const handleClientRemoveWatch = (clientId: string, evt: string) => {
    const client = clients.find((c) => c.id === clientId);
    client?.socket?.off(evt);
    setClientWatchedEvents((prev) => ({
      ...prev,
      [clientId]: (prev[clientId] || []).filter((e) => e !== evt),
    }));
  };

  const currentClient = clients.find((c) => c.id === activeClientId);

  return (
    <div className="space-y-6 bg-slate-950 p-6 text-slate-100 min-h-screen font-sans">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Notifications Gateway Monitor
          </h2>
          <p className="text-xs text-slate-400">
            Namespace: <code className="text-cyan-400">/notifications</code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-mono border ${isAdminConnected ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-slate-900 text-slate-500 border-slate-800"}`}
          >
            Admin:{" "}
            {isAdminConnected
              ? isAdminSubscribed
                ? "LIVE MONITOR"
                : "CONNECTED"
              : "OFFLINE"}
            {isAdminConnected && adminLatencyMs !== null
              ? ` · ${adminLatencyMs}ms`
              : ""}
          </span>
          {!isAdminConnected ? (
            <button
              onClick={handleConnectAdmin}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition"
            >
              Connect Admin
            </button>
          ) : (
            <button
              onClick={handleDisconnectAdmin}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 border border-slate-700 rounded-lg font-semibold transition"
            >
              Disconnect Admin
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Admin Telemetry View */}
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl h-72 flex flex-col">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">
                Client Telemetry (`admin:client_event`)
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                {clientEvents.length === 0 ? (
                  <p className="text-slate-600 italic">
                    No connection events recorded...
                  </p>
                ) : (
                  clientEvents.map((evt, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded border flex justify-between ${evt.type === "connect" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}
                    >
                      <span>
                        <strong>{evt.type.toUpperCase()}</strong> ID:{" "}
                        {evt.clientId}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl h-72 flex flex-col">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">
                Room Telemetry (`admin:room_event`)
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                {roomEvents.length === 0 ? (
                  <p className="text-slate-600 italic">
                    No room events recorded...
                  </p>
                ) : (
                  roomEvents.map((evt, i) => (
                    <div
                      key={i}
                      className="p-2 rounded border bg-indigo-500/10 border-indigo-500/20 text-indigo-300 space-y-1"
                    >
                      <div className="flex justify-between">
                        <span className="font-bold uppercase">
                          {evt.type} room
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 break-all">
                        {JSON.stringify(evt.rooms)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Admin Event Console
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400">Event</label>
                <select
                  value={adminSelectedEvent}
                  onChange={(e) =>
                    setAdminSelectedEvent(e.target.value as AdminEmittableEvent)
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono"
                >
                  <option value="admin:subscribe">admin:subscribe</option>
                  <option value="admin:unsubscribe">admin:unsubscribe</option>
                  <option value="__custom">
                    — Custom / Raw (undocumented) —
                  </option>
                </select>

                {adminSelectedEvent === "__custom" && (
                  <>
                    <input
                      type="text"
                      placeholder="event name"
                      value={adminCustomEventName}
                      onChange={(e) => setAdminCustomEventName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                    />
                    <textarea
                      placeholder='JSON payload, e.g. {"foo":"bar"}'
                      value={adminCustomPayload}
                      onChange={(e) => setAdminCustomPayload(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono resize-none"
                    />
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={adminEmitWithAck}
                        onChange={(e) => setAdminEmitWithAck(e.target.checked)}
                      />
                      Expect ack
                    </label>
                  </>
                )}

                <button
                  onClick={handleAdminEmit}
                  disabled={!isAdminConnected}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded font-semibold"
                >
                  Emit
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400">
                  Watch Event Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="event name to watch"
                    value={watchEventInput}
                    onChange={(e) => setWatchEventInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                  />
                  <button
                    onClick={handleAdminAddWatch}
                    disabled={!isAdminConnected}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs px-3 py-1.5 rounded border border-slate-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {adminWatchedEvents.map((evt) => (
                    <button
                      key={evt}
                      onClick={() => handleAdminRemoveWatch(evt)}
                      title="Click to stop watching"
                      className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono px-1.5 py-0.5 rounded"
                    >
                      {evt} ✕
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-600 italic">
                  `onAny` already logs everything as [RAW] — Watch just
                  highlights one event name in the feed.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl h-60 flex flex-col font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Admin System Logs
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => exportLogs("admin_logs", adminLogs)}
                  className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                >
                  Export
                </button>
                <button
                  onClick={clearAdminLogs}
                  className="text-[10px] text-slate-400 hover:text-rose-400 underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {adminLogs.map((log, i) => (
                <p
                  key={i}
                  className={
                    log.type === "emit"
                      ? "text-cyan-400"
                      : log.type === "warn"
                        ? "text-amber-400"
                        : log.type === "error"
                          ? "text-rose-400"
                          : "text-emerald-400"
                  }
                >
                  [{log.time}] {log.msg}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Client Test Workbench */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 p-5 border border-slate-800 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Simulated Clients
              </h3>
              <button
                onClick={handleAddClient}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700"
              >
                + Add Client
              </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveClientId(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-mono transition ${
                    activeClientId === c.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${c.isConnected ? "bg-emerald-400" : "bg-slate-600"}`}
                  />
                  {c.name}
                  {c.isConnected && clientLatencyMs[c.id] !== undefined
                    ? ` · ${clientLatencyMs[c.id]}ms`
                    : ""}
                </button>
              ))}
            </div>

            {currentClient && (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  {!currentClient.isConnected ? (
                    <button
                      onClick={() => handleConnectClient(currentClient.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-lg font-semibold col-span-2"
                    >
                      Connect {currentClient.name}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDisconnectClient(currentClient.id)}
                      className="bg-rose-600/20 text-rose-400 border border-rose-500/30 text-xs py-2 rounded-lg font-semibold col-span-2"
                    >
                      Disconnect {currentClient.name}
                    </button>
                  )}
                </div>

                {!currentClient.isConnected && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">
                        Connect Project ID
                      </label>
                      <input
                        type="text"
                        value={connectProjectId}
                        onChange={(e) => setConnectProjectId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">
                        Connect App ID
                      </label>
                      <input
                        type="text"
                        value={connectAppId}
                        onChange={(e) => setConnectAppId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[10px] text-slate-400">
                    Joined Rooms ({currentClient.joinedRooms.length})
                  </span>
                  <div className="space-y-1 mt-1">
                    {currentClient.joinedRooms.length === 0 ? (
                      <span className="text-[10px] text-slate-600 italic">
                        None
                      </span>
                    ) : (
                      currentClient.joinedRooms.map((r) => (
                        <div
                          key={roomKey(r)}
                          className="bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1 flex items-center justify-between gap-2"
                        >
                          <span className="text-[10px] font-mono text-emerald-400 break-all">
                            {r.projectId}/{r.appId}/{r.roomId}
                          </span>
                          <button
                            onClick={() =>
                              handleQuickLeaveRoom(currentClient.id, r)
                            }
                            className="text-[10px] text-rose-400 hover:text-rose-300 shrink-0"
                          >
                            Leave
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="text-[10px] text-slate-400">Event</label>
                  <select
                    value={clientSelectedEvent}
                    onChange={(e) =>
                      setClientSelectedEvent(
                        e.target.value as ClientEmittableEvent,
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono"
                  >
                    <option value="join_room">join_room</option>
                    <option value="leave_room">leave_room</option>
                    <option value="join_user_channel">join_user_channel</option>
                    <option value="__custom">
                      — Custom / Raw (undocumented) —
                    </option>
                  </select>

                  {clientSelectedEvent === "join_room" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">
                          Project ID
                        </label>
                        <input
                          type="text"
                          value={targetProjectId}
                          onChange={(e) => setTargetProjectId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">
                          App ID
                        </label>
                        <input
                          type="text"
                          value={targetAppId}
                          onChange={(e) => setTargetAppId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">
                          Room ID
                        </label>
                        <input
                          type="text"
                          value={targetRoomId}
                          onChange={(e) => setTargetRoomId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {clientSelectedEvent === "leave_room" && (
                    <div>
                      <label className="text-[10px] text-slate-400">
                        Select a joined room to leave
                      </label>
                      <select
                        value={leaveRoomKey}
                        onChange={(e) => setLeaveRoomKey(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono"
                      >
                        <option value="">— select room —</option>
                        {currentClient.joinedRooms.map((r) => (
                          <option key={roomKey(r)} value={roomKey(r)}>
                            {r.projectId}/{r.appId}/{r.roomId}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {clientSelectedEvent === "join_user_channel" && (
                    <div>
                      <label className="text-[10px] text-slate-400">
                        User ID
                      </label>
                      <input
                        type="text"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  )}

                  {clientSelectedEvent === "__custom" && (
                    <>
                      <input
                        type="text"
                        placeholder="event name"
                        value={clientCustomEventName}
                        onChange={(e) =>
                          setClientCustomEventName(e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                      />
                      <textarea
                        placeholder='JSON payload, e.g. {"foo":"bar"}'
                        value={clientCustomPayload}
                        onChange={(e) => setClientCustomPayload(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono resize-none"
                      />
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <input
                          type="checkbox"
                          checked={clientEmitWithAck}
                          onChange={(e) =>
                            setClientEmitWithAck(e.target.checked)
                          }
                        />
                        Expect ack
                      </label>
                    </>
                  )}

                  <button
                    onClick={() => handleClientEmit(currentClient.id)}
                    disabled={!currentClient.isConnected}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs py-1.5 rounded font-semibold"
                  >
                    Emit
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">
                    Watch Event Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="event name to watch"
                      value={watchEventInput}
                      onChange={(e) => setWatchEventInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono"
                    />
                    <button
                      onClick={() => handleClientAddWatch(currentClient.id)}
                      disabled={!currentClient.isConnected}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs px-3 py-1.5 rounded border border-slate-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(clientWatchedEvents[currentClient.id] || []).map(
                      (evt) => (
                        <button
                          key={evt}
                          onClick={() =>
                            handleClientRemoveWatch(currentClient.id, evt)
                          }
                          title="Click to stop watching"
                          className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono px-1.5 py-0.5 rounded"
                        >
                          {evt} ✕
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Client Log</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        exportLogs(
                          `${currentClient.name}_logs`,
                          currentClient.logs,
                        )
                      }
                      className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => clearClientLogs(currentClient.id)}
                      className="text-[10px] text-slate-400 hover:text-rose-400 underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="bg-slate-950 p-3 border border-slate-800 rounded-lg h-44 overflow-y-auto space-y-1 font-mono text-[11px]">
                  {currentClient.logs.map((log, i) => (
                    <p
                      key={i}
                      className={
                        log.type === "emit"
                          ? "text-cyan-400"
                          : log.type === "warn"
                            ? "text-amber-400"
                            : "text-slate-300"
                      }
                    >
                      [{log.time}] {log.msg}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
