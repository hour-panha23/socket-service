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
  logs: {
    time: string;
    msg: string;
    type: "info" | "warn" | "error" | "emit";
  }[];
  clearLogs: () => void;
  clientEvents: any[];
  emitLogs: any[];
  connectedClientCount: number;
}

export const RealtimeMonitor: React.FC<RealtimeMonitorProps> = ({
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
}) => {
  // Auth Inputs (Updated: App Secret instead of Ed25519 Private Key)
  const [authMode, setAuthMode] = useState<"app" | "admin">("app");
  const [projectIdInput, setProjectIdInput] = useState("app_46958be0cbd7a17c");
  const [projectSecretInput, setProjectSecretInput] = useState(
    `b01a6222c0cd4e43628a9775756419ecff45d4979bf4bc782322d326f002af9f`,
  );
  const [adminSecretInput, setAdminSecretInput] = useState("");

  // Channel/Room Management Inputs
  const [projectId, setProjectId] = useState("proj_siksara");
  const [appIdRoom, setAppIdRoom] = useState("learning_hub");
  const [channelId, setChannelId] = useState("course_101");
  const [joinedChannels, setJoinedChannels] = useState<string[]>([]);

  // S2S REST Dispatch Inputs
  const [emitScope, setEmitScope] = useState<"project" | "app" | "room">(
    "room",
  );
  const [emitProjectId, setEmitProjectId] = useState("proj_siksara");
  const [emitAppId, setEmitAppId] = useState("learning_hub");
  const [emitRoomId, setEmitRoomId] = useState("course_101");
  const [emitEventName, setEmitEventName] = useState("notification");
  const [emitPayload, setEmitPayload] = useState('{"message":"hello"}');
  const [emitResult, setEmitResult] = useState<string | null>(null);
  const [emitUserId, setEmitUserId] = useState("user_123");

  useEffect(() => {
    if (!socket) return;

    const onRoomJoined = (res: any) => {
      const roomData = res?.data || res;
      logger.info(roomData);

      if (roomData?.roomId || roomData?.channelId) {
        const target = roomData.roomId || roomData.channelId;
        const roomStr = `${roomData.projectId || "default"} / ${roomData.appId || "app"} / ${target}`;
        setJoinedChannels((prev) => [...new Set([...prev, roomStr])]);
      }
    };

    const onRoomLeft = (res: any) => {
      const roomData = res?.data || res;
      const target = roomData?.roomId || roomData?.channelId;
      if (target) {
        setJoinedChannels((prev) =>
          prev.filter((r) => !r.endsWith(`/ ${target}`)),
        );
      }
    };

    socket.on("room_joined", onRoomJoined);
    socket.on("room_left", onRoomLeft);

    return () => {
      socket.off("room_joined", onRoomJoined);
      socket.off("room_left", onRoomLeft);
    };
  }, [socket]);

  const handleConnect = () => {
    if (!projectIdInput.trim()) return alert("Enter an App ID");

    if (authMode === "app") {
      if (!projectSecretInput.trim()) return alert("Enter the App HMAC Secret");
      connectSocket({
        appId: projectIdInput.trim(),
        secret: projectSecretInput.trim(),
        mode: "app",
      });
    } else {
      if (!adminSecretInput.trim()) return alert("Enter the Admin Secret Key");
      connectSocket({
        appId: projectIdInput.trim(),
        secret: adminSecretInput.trim(),
        mode: "admin",
      });
    }
  };

  const handleJoinChannel = () => {
    if (!socket || !isConnected) return alert("Connect socket first!");
    socket.emit("join_room", {
      projectId: projectId.trim(),
      appId: appIdRoom.trim(),
      roomId: channelId.trim(),
    });
  };

  const handleLeaveChannel = () => {
    if (!socket || !isConnected) return alert("Connect socket first!");
    socket.emit("leave_room", {
      projectId: projectId.trim(),
      appId: appIdRoom.trim(),
      roomId: channelId.trim(),
    });
  };

  const handleTriggerEmit = async () => {
    let payload: Record<string, unknown> = {};
    try {
      payload = emitPayload.trim() ? JSON.parse(emitPayload) : {};
    } catch {
      return alert("Payload must be valid JSON");
    }

    const senderSocketId = socket?.id;

    // Strict mapping matching NestJS Emit DTOs
    const bodyMap = {
      project: {
        projectId: emitProjectId,
        event: emitEventName,
        payload,
        senderSocketId,
      },
      app: {
        projectId: emitProjectId,
        appId: emitAppId,
        event: emitEventName,
        payload,
        senderSocketId,
      },
      room: {
        projectId: emitProjectId,
        appId: emitAppId,
        roomId: emitRoomId, // Fixed: changed from targetChannel to roomId
        event: emitEventName,
        payload,
        senderSocketId,
      },
      user: {
        userId: emitUserId,
        event: emitEventName,
        payload,
        senderSocketId,
      },
    };

    try {
      const secret = authMode === "app" ? projectSecretInput : adminSecretInput;
      const signedAuth = await buildSignedAuth(projectIdInput, secret);

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const endpointUrl = `${baseUrl}/notifications/emit/${emitScope}`;

      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-project-id": signedAuth.projectId,
          "x-timestamp": signedAuth.timestamp,
          "x-signature": signedAuth.signature,
        },
        body: JSON.stringify(bodyMap[emitScope]),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      setEmitResult(`✓ Dispatched → ${data.status || "Success"}`);
    } catch (e: any) {
      logger.error(e);
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
                  <div className="flex bg-slate-950 p-0.5 border border-slate-800 rounded-lg">
                    <button
                      onClick={() => setAuthMode("app")}
                      className={`px-2 py-0.5 text-[10px] rounded-md transition ${
                        authMode === "app"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      App
                    </button>
                    <button
                      onClick={() => setAuthMode("admin")}
                      className={`px-2 py-0.5 text-[10px] rounded-md transition ${
                        authMode === "admin"
                          ? "bg-amber-600 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      Admin
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block mb-1 font-medium text-[11px] text-slate-300">
                      App ID
                    </label>
                    <input
                      type="text"
                      placeholder="app_xxxxxxxx"
                      value={projectIdInput}
                      onChange={(e) => setProjectIdInput(e.target.value)}
                      className="bg-slate-950 px-3 py-2 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-mono text-slate-200 text-xs"
                    />
                  </div>
                  {authMode === "app" ? (
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
                  ) : (
                    <div>
                      <label className="block mb-1 font-medium text-[11px] text-slate-300">
                        Admin Secret Key
                      </label>
                      <input
                        type="password"
                        placeholder="ADMIN_SECRET_KEY"
                        value={adminSecretInput}
                        onChange={(e) => setAdminSecretInput(e.target.value)}
                        className="bg-slate-950 px-3 py-2 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-mono text-slate-200 text-xs"
                      />
                    </div>
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
              {/* <span className="font-mono text-[10px] text-indigo-400">
                POST /api/v1/s2s/broadcast
              </span> */}
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
                  <option value="project">Project Scope</option>
                  <option value="app">App Scope</option>
                  <option value="room">Channel Scope</option>
                </select>
              </div>
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
              {emitScope !== "project" && (
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
                  {emitLogs.length} events
                </span>
              </div>
              <div className="flex-1 space-y-2 pr-1 overflow-y-auto">
                {emitLogs.length === 0 ? (
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
                {clientEvents.length === 0 ? (
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
              {logs.length === 0 ? (
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
