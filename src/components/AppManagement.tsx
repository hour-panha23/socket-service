"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { logger } from "../lib/logger";
import { ActionMenu } from "./ActionMenu";

interface AppItem {
  id: string;
  name: string;
  description?: string;
  app_id: string;
  public_key?: string;
  is_active: boolean;
  created_at: string;
}

// Fetch Helper
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${res.status}] ${text.slice(0, 100)}`);
  }
  return res.json();
}

export const AppManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppDesc, setNewAppDesc] = useState("");
  const [secretModalData, setSecretModalData] = useState<{
    appId: string;
    privateKey: string;
  } | null>(null);

  // 1. Query for apps list
  const {
    data: apps = [],
    isLoading,
    isError,
    error,
  } = useQuery<AppItem[]>({
    queryKey: ["apps"],
    queryFn: () => fetchJson<AppItem[]>("/apps"),
  });

  // 2. Mutations
  const createMutation = useMutation({
    mutationFn: (newApp: { name: string; description?: string }) =>
      fetchJson<{ app: AppItem; privateKey: string }>("/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApp),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      setIsCreateOpen(false);
      setNewAppName("");
      setNewAppDesc("");
      setSecretModalData({
        appId: data.app.app_id,
        privateKey: data.privateKey,
      });
    },
    onError: (err) => {
      logger.error(err);
      alert("Failed to create app");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      fetchJson(`/apps/${id}/${active ? "enable" : "disable"}`, {
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apps"] }),
    onError: (err) => {
      logger.error(err);
      alert("Failed to update status");
    },
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ app: AppItem; privateKey: string }>(
        `/apps/${id}/regenerate-secret`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      setSecretModalData({
        appId: data.app.app_id,
        privateKey: data.privateKey,
      });
    },
    onError: (err) => {
      logger.error(err);
      alert("Failed to regenerate secret key");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchJson(`/apps/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apps"] }),
    onError: (err) => {
      logger.error(err);
      alert("Failed to delete app");
    },
  });

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleCreateApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;
    createMutation.mutate({
      name: newAppName,
      description: newAppDesc || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-slate-800/60 border-b">
        <div>
          <h2 className="font-bold text-white text-xl tracking-tight">
            App Management
          </h2>
          <p className="mt-0.5 text-slate-400 text-xs">
            Manage credentials, App IDs, and Secret Keys for registered apps.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 shadow-sm px-4 py-2 rounded-lg font-semibold text-white text-xs transition"
        >
          <Plus className="w-4 h-4" /> Register App
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 shadow-xl border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900/90 border-slate-800 border-b font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="p-4">Application</th>
              <th className="p-4">App ID</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-slate-500 text-center italic"
                >
                  Loading registered apps...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="p-8 text-rose-400 text-center">
                  Error loading apps: {(error as Error).message}
                </td>
              </tr>
            ) : apps.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-slate-500 text-center italic"
                >
                  No apps registered yet.
                </td>
              </tr>
            ) : (
              apps.map((app) => {
                const appIdCopyId = `app-${app.id}`;

                return (
                  <tr key={app.id} className="hover:bg-slate-800/20 transition">
                    <td className="p-4">
                      <p className="font-semibold text-slate-100">{app.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {app.description || "No description"}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 font-mono text-indigo-300 text-xs">
                        <span>{app.app_id}</span>
                        <button
                          onClick={() => handleCopy(app.app_id, appIdCopyId)}
                          className="bg-slate-800 hover:bg-slate-700 px-2 py-0.5 border border-slate-700 rounded text-[11px] text-slate-300 hover:text-white transition"
                        >
                          {copiedField === appIdCopyId ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                          app.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {app.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-400 text-xs">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <ActionMenu
                        app={app}
                        onToggleActive={(id, active) =>
                          toggleActiveMutation.mutate({ id, active })
                        }
                        onRegenerateSecret={(id) =>
                          regenerateSecretMutation.mutate(id)
                        }
                        onDelete={(id) => deleteMutation.mutate(id)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="space-y-4 bg-slate-900 shadow-2xl p-6 border border-slate-800 rounded-xl w-full max-w-md">
            <h3 className="flex items-center gap-2 font-bold text-white text-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> Register New
              Application
            </h3>
            <form onSubmit={handleCreateApp} className="space-y-3">
              <div>
                <label className="block mb-1 font-medium text-[11px] text-slate-300">
                  App Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Learning Hub"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  className="bg-slate-950 p-2 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none w-full text-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-[11px] text-slate-300">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description..."
                  value={newAppDesc}
                  onChange={(e) => setNewAppDesc(e.target.value)}
                  className="bg-slate-950 p-2 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none w-full text-slate-200 text-xs"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 rounded-lg font-semibold text-white text-xs transition"
                >
                  {createMutation.isPending
                    ? "Creating..."
                    : "Create Application"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg font-semibold text-slate-300 text-xs transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secret Modal */}
      {secretModalData && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="space-y-4 bg-slate-900 shadow-2xl p-6 border border-amber-500/30 rounded-xl w-full max-w-md">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm">
                Secret Key Issued — Save Immediately
              </h3>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              This secret key is generated once and cannot be retrieved again
              after closing this dialog.
            </p>

            <div className="space-y-2">
              <div className="flex justify-between items-center bg-slate-950 p-3 border border-slate-800 rounded-lg">
                <div>
                  <p className="font-semibold text-[10px] text-slate-500 uppercase">
                    App Identifier
                  </p>
                  <p className="mt-0.5 font-mono text-indigo-300 text-xs break-all select-all">
                    {secretModalData.appId}
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleCopy(secretModalData.appId, "modal-appid")
                  }
                  className="bg-slate-800 hover:bg-slate-700 ml-2 px-2 py-1 border border-slate-700 rounded font-mono text-[10px] text-slate-300 transition shrink-0"
                >
                  {copiedField === "modal-appid" ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-3 border border-slate-800 rounded-lg">
                <div>
                  <p className="font-semibold text-[10px] text-slate-500 uppercase">
                    Secret Key
                  </p>
                  <p className="mt-0.5 font-mono text-emerald-400 text-xs break-all select-all">
                    {secretModalData.privateKey}
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleCopy(secretModalData.privateKey, "modal-secret")
                  }
                  className="bg-slate-800 hover:bg-slate-700 ml-2 px-2 py-1 border border-slate-700 rounded font-mono text-[10px] text-slate-300 transition shrink-0"
                >
                  {copiedField === "modal-secret" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <button
              onClick={() => setSecretModalData(null)}
              className="bg-slate-800 hover:bg-slate-700 py-2 rounded-lg w-full font-semibold text-slate-200 text-xs transition"
            >
              I have saved my secret key
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
