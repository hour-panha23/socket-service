/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { logger } from "../lib/logger";
import { buildSignedAuth } from "../lib/socket-auth";

interface RealtimeMonitorProps {
  socket: Socket | null;
  isConnected: boolean;
  adminSubscribed: boolean;
  connectSocket: (authData: {
    appId: string;
    secret: string;
    mode: "app" | "admin";
  }) => void;
  disconnectSocket: () => void;
  toggleAdmin: () => void;
  logs?: {
    time: string;
    msg: string;
    type: "info" | "warn" | "error" | "emit";
  }[];
  clearLogs: () => void;
  clientEvents?: any[];
  emitLogs?: any[];
  connectedClientCount?: number;
  // --- New: connection health / control props ---
  latency?: number | null;
  autoReconnect?: boolean;
  toggleAutoReconnect?: () => void;
  lastDisconnectReason?: string | null;
  reconnectAttempt?: number;
}

const latencyColor = (ms: number | null | undefined) => {
  if (ms == null) return "text-slate-500";
  if (ms < 100) return "text-emerald-400";
  if (ms < 300) return "text-amber-400";
  return "text-rose-400";
};

export const RealtimeMonitor: React.FC<RealtimeMonitorProps> = ({
  socket,
  isConnected,
  adminSubscribed,
  connectSocket,
  disconnectSocket,
  toggleAdmin,
  logs = [],
  clearLogs,
  clientEvents = [],
  emitLogs = [],
  connectedClientCount = 0,
  latency = null,
  autoReconnect = true,
  toggleAutoReconnect,
  lastDisconnectReason = null,
  reconnectAttempt = 0,
}) => {
  // Auth Inputs
  const [projectIdInput, setProjectIdInput] = useState(
    "project_e4de70df23a96fdb",
  );
  const [projectSecretInput, setProjectSecretInput] = useState(
    `13e3a980251188f4917925fee2f87b8025e967b92f73484a24d90431189d55cb`,
  );

  // Channel/Room Management Inputs
  const [projectId, setProjectId] = useState("project_e4de70df23a96fdb");
  const [appIdRoom, setAppIdRoom] = useState(
    "8AE496F4C88EB47721B5B202EBDBC546",
  );
  const [channelId, setChannelId] = useState("invoices");
  const [joinedChannels, setJoinedChannels] = useState<string[]>([]);

  // S2S REST Dispatch Inputs
  const [emitScope, setEmitScope] = useState<
    "project" | "app" | "room" | "user" | "broadcast"
  >("room");
  const [emitProjectId, setEmitProjectId] = useState(
    "project_e4de70df23a96fdb",
  );
  const [emitAppId, setEmitAppId] = useState(
    "8AE496F4C88EB47721B5B202EBDBC546",
  );
  const [emitRoomId, setEmitRoomId] = useState("invoices");
  const [emitUserId, setEmitUserId] = useState("user_123");
  const [emitEventName, setEmitEventName] = useState("notification");
  const [emitPayload, setEmitPayload] = useState('{"message":"hello"}');
  const [emitResult, setEmitResult] = useState<string | null>(null);

  const [roomStatus, setRoomStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const applyRoomJoined = (res: any) => {
      const roomData = res?.data || res;
      logger.info(roomData);

      if (roomData?.roomId || roomData?.channelId) {
        const target = roomData.roomId || roomData.channelId;
        const roomStr = `${roomData.projectId || "default"} / ${roomData.appId || "app"} / ${target}`;
        setJoinedChannels((prev) => [...new Set([...prev, roomStr])]);
        setRoomStatus(`✓ Joined ${roomStr}`);
      }
    };

    const applyRoomLeft = (res: any) => {
      const roomData = res?.data || res;
      const target = roomData?.roomId || roomData?.channelId;
      if (target) {
        setJoinedChannels((prev) =>
          prev.filter((r) => !r.endsWith(`/ ${target}`)),
        );
        setRoomStatus(`✓ Left ${target}`);
      }
    };

    // Server-pushed rebroadcast (if the gateway emits it separately)
    socket.on("room_joined", applyRoomJoined);
    socket.on("room_left", applyRoomLeft);

    // Guard/validation failures land here — e.g. WsAppAuthGuard rejecting a
    // projectId/appId mismatch. Without this listener, a rejected join_room
    // fails completely silently on the client.
    const onException = (err: any) => {
      const message =
        typeof err === "string" ? err : err?.message || JSON.stringify(err);
      logger.error(`[WS Exception] ${message}`);
      setRoomStatus(`✗ Rejected: ${message}`);
    };
    socket.on("exception", onException);

    return () => {
      socket.off("room_joined", applyRoomJoined);
      socket.off("room_left", applyRoomLeft);
      socket.off("exception", onException);
    };
  }, [socket]);

  const handleConnect = () => {
    if (!projectIdInput.trim()) return alert("Enter an App ID");
    if (!projectSecretInput.trim()) return alert("Enter the App HMAC Secret");

    connectSocket({
      appId: projectIdInput.trim(),
      secret: projectSecretInput.trim(),
      mode: "app",
    });
  };

  const handleJoinChannel = () => {
    if (!socket || !isConnected) return alert("Connect socket first!");
    setRoomStatus("Joining…");
    socket.emit(
      "join_room",
      {
        projectId: projectId.trim(),
        appId: appIdRoom.trim(),
        roomId: channelId.trim(),
      },
      (ack: any) => {
        // Handler on the gateway returns { event: 'room_joined', data },
        // which socket.io delivers here as the ack — this is the
        // authoritative response, independent of any rebroadcast event.
        if (!ack) {
          setRoomStatus(
            "✗ No response from server — check WsAppAuthGuard / room:join permissions",
          );
          return;
        }
        const roomData = ack?.data || ack;
        if (roomData?.status === "success" || ack?.event === "room_joined") {
          const target = roomData.roomId || roomData.channelId || channelId;
          const roomStr = `${roomData.projectId || projectId} / ${roomData.appId || appIdRoom} / ${target}`;
          setJoinedChannels((prev) => [...new Set([...prev, roomStr])]);
          setRoomStatus(`✓ Joined ${roomStr}`);
        } else {
          setRoomStatus(`✗ Rejected: ${ack?.message || JSON.stringify(ack)}`);
        }
      },
    );
  };

  const handleLeaveChannel = () => {
    if (!socket || !isConnected) return alert("Connect socket first!");
    setRoomStatus("Leaving…");
    socket.emit(
      "leave_room",
      {
        projectId: projectId.trim(),
        appId: appIdRoom.trim(),
        roomId: channelId.trim(),
      },
      (ack: any) => {
        if (!ack) {
          setRoomStatus("✗ No response from server");
          return;
        }
        const roomData = ack?.data || ack;
        const target = roomData?.roomId || channelId;
        setJoinedChannels((prev) =>
          prev.filter((r) => !r.endsWith(`/ ${target}`)),
        );
        setRoomStatus(`✓ Left ${target}`);
      },
    );
  };

  const handleTriggerEmit = async () => {
    let payload: Record<string, unknown> = {};
    try {
      payload = emitPayload.trim() ? JSON.parse(emitPayload) : {};
    } catch {
      return alert("Payload must be valid JSON");
    }

    const bodyPayload: Record<string, any> = {
      event: emitEventName,
      payload,
    };

    if (emitScope === "broadcast") {
      // Global broadcast - no tenant IDs attached
    } else if (emitScope === "project") {
      bodyPayload.project_id = emitProjectId;
    } else if (emitScope === "app") {
      bodyPayload.project_id = emitProjectId;
      bodyPayload.app_id = emitAppId;
    } else if (emitScope === "room") {
      bodyPayload.project_id = emitProjectId;
      bodyPayload.app_id = emitAppId;
      bodyPayload.room = emitRoomId;
    } else if (emitScope === "user") {
      bodyPayload.project_id = emitProjectId;
      bodyPayload.app_id = emitAppId;
      bodyPayload.user_id = emitUserId;
    }

    try {
      const secret = projectSecretInput;
      const targetProjectId = bodyPayload.project_id || projectIdInput;

      const jsonBodyString = JSON.stringify(bodyPayload);
      const signedAuth = await buildSignedAuth(targetProjectId, secret);

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const endpointUrl = `${baseUrl}/notifications/emit`;

      logger.info(
        `→ Dispatching "${emitEventName}" [scope: ${emitScope}] → ${endpointUrl}`,
      );

      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-project-id": signedAuth.projectId,
          "x-timestamp": signedAuth.timestamp,
          "x-signature": signedAuth.signature,
        },
        body: jsonBodyString,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      setEmitResult(`✓ Dispatched → Scope: ${data.scope || "Success"}`);
      logger.info(
        `✓ "${emitEventName}" succeeded → scope: ${data.scope || emitScope}, recipients: ${data.recipientCount ?? "n/a"}`,
      );
    } catch (e: any) {
      logger.error(
        `✗ "${emitEventName}" failed [scope: ${emitScope}] → ${e.message || "Failed to send payload"}`,
      );
      setEmitResult(`✗ Failed: ${e.message || "Failed to send payload"}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-slate-800/60 border-b">
        <div>
          <h2 className="font-bold text-white text-xl tracking-tight">
            Realtime Gateway Monitor
          </h2>
          <p className="mt-0.5 text-slate-400 text-xs">
            Adapter Mode:{" "}
            <code className="bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono text-[11px] text-indigo-300">
              Redis Multi-Node Gateway
            </code>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Latency indicator */}
          {isConnected && (
            <span className="inline-flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 border border-slate-700 rounded-full font-mono text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full ${latency == null ? "bg-slate-500" : latency < 100 ? "bg-emerald-400" : latency < 300 ? "bg-amber-400" : "bg-rose-400"}`}
              />
              <span className={latencyColor(latency)}>
                {latency == null ? "measuring…" : `${latency}ms`}
              </span>
            </span>
          )}

          {/* Reconnect-in-progress indicator */}
          {!isConnected && reconnectAttempt > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 border border-amber-500/20 rounded-full font-mono text-amber-400 text-xs">
              <span className="bg-amber-400 rounded-full w-1.5 h-1.5 animate-pulse" />
              Reconnecting (#{reconnectAttempt})…
            </span>
          )}

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              adminSubscribed
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                adminSubscribed ? "bg-amber-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            {adminSubscribed ? "Admin Feed Live" : "Admin Feed Inactive"}
          </span>
        </div>
      </div>

      <div className="items-start gap-6 grid grid-cols-1 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="gap-6 grid grid-cols-1 lg:grid-cols-2">
            {/* Card 1: HMAC Auth */}
            <div className="flex flex-col justify-between space-y-4 bg-slate-900/60 p-5 border border-slate-800 rounded-xl">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">
                    1. HMAC-SHA256 Client Auth
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block mb-1 font-medium text-[11px] text-slate-300">
                      Project ID
                    </label>
                    <input
                      type="text"
                      placeholder="project_xxxxxxxx"
                      value={projectIdInput}
                      onChange={(e) => setProjectIdInput(e.target.value)}
                      className="bg-slate-950 px-3 py-2 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-mono text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-[11px] text-slate-300">
                      App Secret
                    </label>
                    <input
                      type="password"
                      placeholder="App Secret String"
                      value={projectSecretInput}
                      onChange={(e) => setProjectSecretInput(e.target.value)}
                      className="bg-slate-950 px-3 py-2 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-mono text-slate-200 text-xs"
                    />
                  </div>

                  {/* Auto-reconnect toggle */}
                  <div className="flex justify-between items-center bg-slate-950/60 px-3 py-2 border border-slate-800 rounded-lg">
                    <span className="text-[11px] text-slate-300">
                      Auto-Reconnect
                    </span>
                    <button
                      type="button"
                      onClick={toggleAutoReconnect}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                        autoReconnect ? "bg-indigo-600" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
                          autoReconnect ? "translate-x-4.5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Last disconnect reason */}
                  {!isConnected && lastDisconnectReason && (
                    <p className="text-[10px] text-rose-400/80 italic">
                      Last disconnect: {lastDisconnectReason}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="gap-2 grid grid-cols-2">
                  <button
                    onClick={handleConnect}
                    disabled={isConnected}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-sm px-3 py-2 rounded-lg font-semibold text-white text-xs transition"
                  >
                    Connect
                  </button>
                  <button
                    onClick={disconnectSocket}
                    disabled={!isConnected}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3 py-2 border border-slate-700/50 rounded-lg font-semibold text-slate-300 text-xs transition"
                  >
                    Disconnect
                  </button>
                </div>
                <button
                  onClick={toggleAdmin}
                  disabled={!isConnected}
                  className="bg-amber-600/20 hover:bg-amber-600/30 disabled:opacity-50 px-3 py-2 border border-amber-500/30 rounded-lg w-full font-semibold text-amber-400 text-xs transition"
                >
                  {adminSubscribed
                    ? "Unsubscribe Admin Feed"
                    : "Subscribe Admin Feed"}
                </button>
              </div>
            </div>

            {/* Card 2: Channel Manager */}
            <div className="flex flex-col justify-between space-y-4 bg-slate-900/60 p-5 border border-slate-800 rounded-xl">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">
                    2. Channel & Presence Manager
                  </h3>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <label className="block mb-0.5 text-[10px] text-slate-400">
                      Project ID
                    </label>
                    <input
                      type="text"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="bg-slate-950 px-2.5 py-1.5 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none w-full font-mono text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block mb-0.5 text-[10px] text-slate-400">
                      App ID
                    </label>
                    <input
                      type="text"
                      value={appIdRoom}
                      onChange={(e) => setAppIdRoom(e.target.value)}
                      className="bg-slate-950 px-2.5 py-1.5 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none w-full font-mono text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block mb-0.5 text-[10px] text-slate-400">
                      Target Topic
                    </label>
                    <input
                      type="text"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                      className="bg-slate-950 px-2.5 py-1.5 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none w-full font-mono text-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="gap-2 grid grid-cols-2 pt-2">
                <button
                  onClick={handleJoinChannel}
                  disabled={!isConnected}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 shadow-sm px-3 py-2 rounded-lg font-semibold text-white text-xs transition"
                >
                  Join Topic
                </button>
                <button
                  onClick={handleLeaveChannel}
                  disabled={!isConnected}
                  className="bg-rose-600/20 hover:bg-rose-600/30 disabled:opacity-50 px-3 py-2 border border-rose-500/30 rounded-lg font-semibold text-rose-400 text-xs transition"
                >
                  Leave Topic
                </button>
              </div>
              {roomStatus && (
                <p
                  className={`text-[10px] font-mono pt-1 ${roomStatus.startsWith("✗") ? "text-rose-400" : "text-emerald-400"}`}
                >
                  {roomStatus}
                </p>
              )}
            </div>

            {/* Active Subscriptions */}
            <div className="flex flex-col justify-between lg:col-span-2 bg-slate-900/60 p-5 border border-slate-800 rounded-xl">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">
                    Subscribed Topics
                  </h3>
                </div>
                <ul className="space-y-2 pr-1 max-h-48 overflow-y-auto">
                  {joinedChannels.length === 0 ? (
                    <li className="bg-slate-950/40 p-3 border border-slate-800 border-dashed rounded-lg text-slate-500 text-xs text-center italic">
                      No active topic subscriptions
                    </li>
                  ) : (
                    joinedChannels.map((ch, idx) => (
                      <li
                        key={idx}
                        className="flex justify-between items-center bg-slate-950 p-2.5 border border-slate-800 rounded-lg font-mono text-slate-300 text-xs"
                      >
                        {ch}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* S2S Dispatcher */}
          <div className="space-y-4 bg-slate-900/60 p-5 border border-slate-800 rounded-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">
                3. Server-to-Server (S2S) HMAC Broadcaster
              </h3>
            </div>

            <div className="gap-3 grid grid-cols-1 md:grid-cols-6">
              <div className="md:col-span-1">
                <label className="block mb-1 text-[10px] text-slate-400">
                  Target Scope
                </label>
                <select
                  value={emitScope}
                  onChange={(e) => setEmitScope(e.target.value as any)}
                  className="bg-slate-950 p-2 border border-slate-800 rounded-lg w-full font-medium text-slate-200 text-xs"
                >
                  <option value="broadcast">Global Broadcast</option>
                  <option value="project">Project Scope</option>
                  <option value="app">App Scope</option>
                  <option value="room">Channel Scope</option>
                  <option value="user">User Scope</option>
                </select>
              </div>

              {emitScope !== "broadcast" && (
                <div>
                  <label className="block mb-1 text-[10px] text-slate-400">
                    Project ID
                  </label>
                  <input
                    type="text"
                    value={emitProjectId}
                    onChange={(e) => setEmitProjectId(e.target.value)}
                    className="bg-slate-950 p-2 border border-slate-800 rounded-lg w-full font-mono text-slate-200 text-xs"
                  />
                </div>
              )}

              {(emitScope === "app" ||
                emitScope === "room" ||
                emitScope === "user") && (
                <div>
                  <label className="block mb-1 text-[10px] text-slate-400">
                    App ID
                  </label>
                  <input
                    type="text"
                    value={emitAppId}
                    onChange={(e) => setEmitAppId(e.target.value)}
                    className="bg-slate-950 p-2 border border-slate-800 rounded-lg w-full font-mono text-slate-200 text-xs"
                  />
                </div>
              )}

              {emitScope === "room" && (
                <div>
                  <label className="block mb-1 text-[10px] text-slate-400">
                    Channel ID
                  </label>
                  <input
                    type="text"
                    value={emitRoomId}
                    onChange={(e) => setEmitRoomId(e.target.value)}
                    className="bg-slate-950 p-2 border border-slate-800 rounded-lg w-full font-mono text-slate-200 text-xs"
                  />
                </div>
              )}

              {emitScope === "user" && (
                <div>
                  <label className="block mb-1 text-[10px] text-slate-400">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={emitUserId}
                    onChange={(e) => setEmitUserId(e.target.value)}
                    className="bg-slate-950 p-2 border border-slate-800 rounded-lg w-full font-mono text-slate-200 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block mb-1 text-[10px] text-slate-400">
                  Event Name
                </label>
                <input
                  type="text"
                  value={emitEventName}
                  onChange={(e) => setEmitEventName(e.target.value)}
                  className="bg-slate-950 p-2 border border-slate-800 rounded-lg w-full font-mono text-indigo-300 text-xs"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleTriggerEmit}
                  className="bg-indigo-600 hover:bg-indigo-500 shadow-sm py-2 rounded-lg w-full font-semibold text-white text-xs transition"
                >
                  Dispatch S2S
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400">
                JSON Data Payload
              </label>
              <textarea
                rows={2}
                value={emitPayload}
                onChange={(e) => setEmitPayload(e.target.value)}
                className="bg-slate-950 p-3 border border-slate-800 rounded-lg w-full font-mono text-emerald-400 text-xs placeholder-slate-700"
              />
            </div>
            {emitResult && (
              <div className="min-h-4 font-mono text-slate-400 text-xs">
                {emitResult}
              </div>
            )}
          </div>

          {/* Feeds */}
          <div className="gap-6 grid grid-cols-1 lg:grid-cols-2">
            <div className="flex flex-col bg-slate-900/60 p-4 border border-slate-800 rounded-xl h-80">
              <div className="flex justify-between items-center mb-3 pb-2 border-slate-800/80 border-b">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-400 rounded-full w-2 h-2" />
                  <h3 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
                    Live Telemetry Feed
                  </h3>
                </div>
                <span className="bg-slate-800 px-2 py-0.5 rounded font-mono text-[10px] text-slate-400">
                  {emitLogs?.length ?? 0} events
                </span>
              </div>
              <div className="flex-1 space-y-2 pr-1 overflow-y-auto">
                {(emitLogs?.length ?? 0) === 0 ? (
                  <p className="p-4 text-slate-500 text-xs text-center italic">
                    Subscribe to admin feed...
                  </p>
                ) : (
                  emitLogs.map((entry, i) => (
                    <div
                      key={i}
                      className="space-y-1 bg-slate-950 p-3 border border-slate-800 rounded-lg text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-semibold text-indigo-300">
                          {entry.event}
                        </span>
                        <span className="bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/20 rounded font-mono text-[11px] text-emerald-400">
                          {entry.recipientCount} client(s)
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-400">
                        scope: {entry.scope} → {entry.target}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col bg-slate-900/60 p-4 border border-slate-800 rounded-xl h-80">
              <div className="flex justify-between items-center mb-3 pb-2 border-slate-800/80 border-b">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-400 rounded-full w-2 h-2" />
                  <h3 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
                    Client Lifetime Monitor
                  </h3>
                </div>
                <span className="bg-slate-800 px-2 py-0.5 rounded font-mono text-[10px] text-slate-400">
                  {connectedClientCount} connected
                </span>
              </div>
              <div className="flex-1 space-y-1.5 pr-1 overflow-y-auto font-mono text-xs">
                {(clientEvents?.length ?? 0) === 0 ? (
                  <p className="p-4 font-sans text-slate-500 text-xs text-center italic">
                    Subscribe to admin feed...
                  </p>
                ) : (
                  clientEvents.map((evt, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded border text-[11px] flex justify-between ${evt.type === "connect" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-rose-400 bg-rose-500/10 border-rose-500/20"}`}
                    >
                      <span>
                        [{new Date(evt.timestamp).toLocaleTimeString()}]{" "}
                        <strong>{evt.type.toUpperCase()}</strong> {evt.clientId}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Terminal */}
        <div className="top-6 sticky xl:col-span-1">
          <div className="flex flex-col bg-slate-950 shadow-2xl p-4 border border-slate-800 rounded-xl h-[calc(100vh-8rem)]">
            <div className="flex justify-between items-center mb-3 pb-2 border-slate-800/80 border-b">
              <div className="flex items-center gap-2">
                <span className="text-xs">💻</span>
                <h3 className="font-mono text-slate-400 text-xs uppercase">
                  Client Log Terminal
                </h3>
              </div>
              <button
                onClick={clearLogs}
                className="px-2 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-300 transition"
              >
                Clear Console
              </button>
            </div>
            <div className="flex-1 space-y-1.5 pr-1 overflow-y-auto font-mono text-xs">
              {(logs?.length ?? 0) === 0 ? (
                <p className="p-4 text-slate-600 text-xs text-center italic">
                  Terminal ready...
                </p>
              ) : (
                logs.map((log, i) => (
                  <p
                    key={i}
                    className={`leading-relaxed break-all ${log.type === "error" ? "text-rose-400" : log.type === "warn" ? "text-amber-400" : log.type === "emit" ? "text-cyan-400 font-semibold" : "text-emerald-400"}`}
                  >
                    [{log.time}] {log.msg}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
