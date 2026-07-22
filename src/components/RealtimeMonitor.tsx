/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { logger } from "../lib/logger";

interface RealtimeMonitorProps {
  socket: Socket | null;
  isConnected: boolean;
  adminSubscribed: boolean;
  connectSocket: (authData: {
    appId: string;
    // Ed25519 PEM private key when mode is "app", raw HMAC secret when "admin"
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
  // Auth Inputs
  const [authMode, setAuthMode] = useState<"app" | "admin">("app");
  const [appIdInput, setAppIdInput] = useState("app_9e82c6c022c4a795");
  const [privateKeyInput, setPrivateKeyInput] = useState(
    "-----BEGIN PRIVATE KEY-----MC4CAQAwBQYDK2VwBCIEIMXdmGwYqdwgaj4+gujvk2YbalMROzzvyYVCQtLD1Uin-----END PRIVATE KEY-----",
  );
  const [adminSecretInput, setAdminSecretInput] = useState("");

  // Room Inputs
  const [projectId, setProjectId] = useState("proj_siksara");
  const [appIdRoom, setAppIdRoom] = useState("learning_hub");
  const [roomId, setRoomId] = useState("course_101");
  const [joinedRooms, setJoinedRooms] = useState<string[]>([]);

  // REST Dispatch Inputs
  const [emitScope, setEmitScope] = useState<"project" | "app" | "room">(
    "room",
  );
  const [emitProjectId, setEmitProjectId] = useState("proj_siksara");
  const [emitAppId, setEmitAppId] = useState("learning_hub");
  const [emitRoomId, setEmitRoomId] = useState("course_101");
  const [emitEventName, setEmitEventName] = useState("notification");
  const [emitPayload, setEmitPayload] = useState('{"message":"hello"}');
  const [emitResult, setEmitResult] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const onRoomJoined = (res: any) => {
      // Handle both { data: { projectId, appId, roomId } } and direct { projectId, appId, roomId }
      const roomData = res?.data || res;

      logger.info(roomData);

      if (roomData?.projectId && roomData?.appId && roomData?.roomId) {
        const roomStr = `${roomData.projectId} / ${roomData.appId} / ${roomData.roomId}`;
        setJoinedRooms((prev) => [...new Set([...prev, roomStr])]);
      }
    };

    const onRoomLeft = (res: any) => {
      const roomData = res?.data || res;
      if (roomData?.roomId) {
        setJoinedRooms((prev) =>
          prev.filter((r) => !r.endsWith(`/ ${roomData.roomId}`)),
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
    if (!appIdInput.trim()) {
      return alert("Enter an App ID");
    }

    if (authMode === "app") {
      if (!privateKeyInput.trim()) {
        return alert("Enter the app's Private Key");
      }
      connectSocket({
        appId: appIdInput.trim(),
        secret: privateKeyInput.trim(),
        mode: "app",
      });
    } else {
      if (!adminSecretInput.trim()) {
        return alert("Enter the Admin Secret Key");
      }
      connectSocket({
        appId: appIdInput.trim(),
        secret: adminSecretInput.trim(),
        mode: "admin",
      });
    }
  };

  const handleJoinRoom = () => {
    if (!socket || !isConnected) return alert("Connect socket first!");
    socket.emit("join_room", {
      projectId: projectId.trim(),
      appId: appIdRoom.trim(),
      roomId: roomId.trim(),
    }); // no callback — response arrives via the 'room_joined' listener above
  };

  const handleLeaveRoom = () => {
    if (!socket || !isConnected) return alert("Connect socket first!");
    socket.emit("leave_room", {
      projectId: projectId.trim(),
      appId: appIdRoom.trim(),
      roomId: roomId.trim(),
    });
  };

  const handleTriggerEmit = async () => {
    let payload = {};
    try {
      payload = emitPayload.trim() ? JSON.parse(emitPayload) : {};
    } catch {
      return alert("Payload must be valid JSON");
    }

    const senderSocketId = socket?.id;

    const bodyMap = {
      project: { projectId: emitProjectId, event: emitEventName, payload },
      app: {
        projectId: emitProjectId,
        appId: emitAppId,
        event: emitEventName,
        payload,
      },
      room: {
        projectId: emitProjectId,
        appId: emitAppId,
        roomId: emitRoomId,
        event: emitEventName,
        payload,
        senderSocketId,
      },
    };

    try {
      const res = await fetch(`/notifications/emit/${emitScope}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyMap[emitScope]),
      });
      const data = await res.json();
      setEmitResult(
        `✓ Dispatched → ${data.recipientCount} client(s) in "${data.target}" received "${data.event}"`,
      );
    } catch (e: any) {
      logger.error(e);
      setEmitResult("✗ Failed to send payload");
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex justify-between items-center pb-4 border-slate-800/60 border-b">
        <div>
          <h2 className="font-bold text-white text-xl tracking-tight">
            Realtime Gateway Monitor
          </h2>
          <p className="mt-0.5 text-slate-400 text-xs">
            Namespace active:{" "}
            <code className="bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono text-[11px] text-indigo-300">
              /notifications
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

      {/* Main 2-Column Dashboard Layout */}
      <div className="items-start gap-6 grid grid-cols-1 xl:grid-cols-3">
        {/* Left Column: Controls and Feeds */}
        <div className="space-y-6 xl:col-span-2">
          {/* Section 1: Auth, Room Manager, Active Rooms */}
          <div className="gap-6 grid grid-cols-1 lg:grid-cols-2">
            {/* Card 1: Auth */}
            <div className="flex flex-col justify-between space-y-4 bg-slate-900/60 p-5 border border-slate-800 rounded-xl">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">
                    1. Client Authentication
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
                      value={appIdInput}
                      onChange={(e) => setAppIdInput(e.target.value)}
                      className="bg-slate-950 px-3 py-2 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-mono text-slate-200 text-xs placeholder-slate-600"
                    />
                  </div>
                  {authMode === "app" ? (
                    <div>
                      <label className="block mb-1 font-medium text-[11px] text-slate-300">
                        Private Key
                      </label>
                      <textarea
                        rows={4}
                        placeholder="-----BEGIN PRIVATE KEY-----..."
                        value={privateKeyInput}
                        onChange={(e) => setPrivateKeyInput(e.target.value)}
                        className="bg-slate-950 p-2 border border-slate-800 rounded-lg w-full font-mono text-[10px] text-slate-200"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        Ed25519-signed locally — never sent as-is over the wire.
                      </p>
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
                        className="bg-slate-950 px-3 py-2 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-mono text-slate-200 text-xs placeholder-slate-600"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {`HMAC-SHA256 signed locally — matches the server's`}{" "}
                        <code className="text-amber-400">ADMIN_SECRET_KEY</code>{" "}
                        env var.
                      </p>
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

            {/* Card 2: Room Manager */}
            <div className="flex flex-col justify-between space-y-4 bg-slate-900/60 p-5 border border-slate-800 rounded-xl">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">
                    2. Room Manager
                  </h3>
                  <span className="font-mono text-[10px] text-slate-500">
                    Hierarchical Room
                  </span>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <label className="block mb-0.5 text-[10px] text-slate-400">
                      Project Key
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
                      App Identifier
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
                      Target Channel/Room ID
                    </label>
                    <input
                      type="text"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      className="bg-slate-950 px-2.5 py-1.5 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none w-full font-mono text-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="gap-2 grid grid-cols-2 pt-2">
                <button
                  onClick={handleJoinRoom}
                  disabled={!isConnected}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 shadow-sm px-3 py-2 rounded-lg font-semibold text-white text-xs transition"
                >
                  Join Room
                </button>
                <button
                  onClick={handleLeaveRoom}
                  disabled={!isConnected}
                  className="bg-rose-600/20 hover:bg-rose-600/30 disabled:opacity-50 px-3 py-2 border border-rose-500/30 rounded-lg font-semibold text-rose-400 text-xs transition"
                >
                  Leave Room
                </button>
              </div>
            </div>

            {/* Card 3: Active Subscriptions */}
            <div className="flex flex-col justify-between lg:col-span-2 bg-slate-900/60 p-5 border border-slate-800 rounded-xl">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">
                    Subscribed Rooms
                  </h3>
                  <span className="bg-slate-800 px-2 py-0.5 rounded font-mono text-[10px] text-slate-400">
                    Active
                  </span>
                </div>
                <ul className="space-y-2 pr-1 max-h-48 overflow-y-auto">
                  {joinedRooms.length === 0 ? (
                    <li className="bg-slate-950/40 p-3 border border-slate-800 border-dashed rounded-lg text-slate-500 text-xs text-center italic">
                      No active room subscriptions
                    </li>
                  ) : (
                    joinedRooms.map((room, idx) => (
                      <li
                        key={idx}
                        className="flex justify-between items-center bg-slate-950 p-2.5 border border-slate-800 rounded-lg font-mono text-slate-300 text-xs"
                      >
                        {room}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Section 2: REST Dispatcher */}
          <div className="space-y-4 bg-slate-900/60 p-5 border border-slate-800 rounded-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wider">
                3. Rest Broadcaster Dispatch
              </h3>
              <span className="font-mono text-[10px] text-indigo-400">
                POST /notifications/emit/:scope
              </span>
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
                  <option value="room">Room Scope</option>
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
                    Room ID
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
                  Dispatch Payload
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

          {/* Section 3: Telemetry & Lifetime Feeds */}
          <div className="gap-6 grid grid-cols-1 lg:grid-cols-2">
            {/* Live Telemetry Feed */}
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
                    Subscribe to admin feed to capture broadcast events...
                  </p>
                ) : (
                  emitLogs.map((entry, i) => (
                    <div
                      key={i}
                      className="space-y-1 bg-slate-950 shadow-sm p-3 border border-slate-800 rounded-lg text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="font-mono font-semibold text-indigo-300">
                            {entry.event}
                          </span>
                          {entry.rawEvent && entry.rawEvent !== entry.event && (
                            <span className="font-mono text-[10px] text-slate-500">
                              raw: {entry.rawEvent}
                            </span>
                          )}
                        </div>
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

            {/* Client Lifetime Monitor */}
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
                    Subscribe to admin feed to view connect/disconnect
                    actions...
                  </p>
                ) : (
                  clientEvents.map((evt, i) => {
                    const isConnect = evt.type === "connect";
                    return (
                      <div
                        key={i}
                        className={`p-2 rounded border text-[11px] flex justify-between ${
                          isConnect
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                        }`}
                      >
                        <span>
                          [{new Date(evt.timestamp).toLocaleTimeString()}]{" "}
                          <strong>{evt.type.toUpperCase()}</strong>{" "}
                          {evt.clientId}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pinned Client Log Terminal */}
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
                  Terminal ready. Logs will stream here...
                </p>
              ) : (
                logs.map((log, i) => (
                  <p
                    key={i}
                    className={`leading-relaxed break-all ${
                      log.type === "error"
                        ? "text-rose-400"
                        : log.type === "warn"
                          ? "text-amber-400"
                          : log.type === "emit"
                            ? "text-cyan-400 font-semibold"
                            : "text-emerald-400"
                    }`}
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
