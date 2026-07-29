"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Plus, ShieldCheck, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { logger } from "../lib/logger";
import { ActionMenu } from "./ActionMenu";

interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

interface AppItem {
  id: string;
  app_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  secret_key?: string;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${res.status}] ${text.slice(0, 100)}`);
  }
  const json: ApiResponse<T> = await res.json();
  return json.data;
}

export const AppManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppDesc, setNewAppDesc] = useState("");
  const [pendingRegenerateApp, setPendingRegenerateApp] =
    useState<AppItem | null>(null);
  const [secretModalData, setSecretModalData] = useState<{
    appId: string;
    secretKey: string;
  } | null>(null);

  const {
    data: apps = [],
    isLoading,
    isError,
    error,
  } = useQuery<AppItem[]>({
    queryKey: ["apps"],
    queryFn: () => fetchJson<AppItem[]>("/apps/list"),
  });

  const createMutation = useMutation({
    mutationFn: (newApp: { name: string; description?: string }) =>
      fetchJson<AppItem>("/apps/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApp),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      setIsCreateOpen(false);
      setNewAppName("");
      setNewAppDesc("");
      toast.success("Application created successfully", {
        description: `${data.name} is now ready to use`,
      });
      if (data.secret_key)
        setSecretModalData({ appId: data.app_id, secretKey: data.secret_key });
    },
    onError: (err) => {
      logger.error(err);
      toast.error("Failed to create app", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      fetchJson<AppItem>(`/apps/${id}/${active ? "enable" : "disable"}`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("App status updated successfully");
    },
    onError: (err) => {
      logger.error(err);
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    },
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson<AppItem>(`/apps/${id}/regenerate-secret`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      setPendingRegenerateApp(null);
      toast.success("Secret key regenerated", {
        description: "Your new secret key is displayed below",
      });
      if (data.secret_key)
        setSecretModalData({ appId: data.app_id, secretKey: data.secret_key });
    },
    onError: (err) => {
      logger.error(err);
      toast.error("Failed to regenerate secret key", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson<void>(`/apps/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("App deleted successfully");
    },
    onError: (err) => {
      logger.error(err);
      toast.error("Failed to delete app", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    },
  });

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    toast.success("Copied to clipboard", {
      duration: 1500,
      position: "bottom-center",
    });
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
                  colSpan={5}
                  className="p-8 text-slate-500 text-center italic"
                >
                  Loading registered apps...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="p-8 text-rose-400 text-center">
                  Error loading apps: {(error as Error).message}
                </td>
              </tr>
            ) : apps.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
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

                    {/* FLIP-FLOP TOGGLE WITH INTERNAL TEXT */}
                    <td className="p-4">
                      <button
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: app.id,
                            active: !app.is_active,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                          app.is_active ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                            app.is_active ? "translate-x-6" : "translate-x-1"
                          }`}
                        >
                          {app.is_active ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <X className="w-3 h-3 text-slate-500" />
                          )}
                        </span>
                      </button>
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
                        onRegenerateSecret={() => setPendingRegenerateApp(app)}
                        onDelete={() => deleteMutation.mutate(app.id)}
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

      {/* Confirmation Modal for Regenerate Secret */}
      {pendingRegenerateApp && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="space-y-4 bg-slate-900 shadow-2xl p-6 border border-rose-500/30 rounded-xl w-full max-w-md">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm">Regenerate Secret Key</h3>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              This invalidates the current secret key immediately for{" "}
              <span className="font-semibold text-white">
                {pendingRegenerateApp.name}
              </span>
              . Continue?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={regenerateSecretMutation.isPending}
                onClick={() =>
                  regenerateSecretMutation.mutate(pendingRegenerateApp.id)
                }
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 py-2 rounded-lg font-semibold text-white text-xs transition"
              >
                {regenerateSecretMutation.isPending
                  ? "Regenerating..."
                  : "Regenerate Key"}
              </button>
              <button
                type="button"
                onClick={() => setPendingRegenerateApp(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg font-semibold text-slate-300 text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Modal */}
      {secretModalData && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="space-y-5 bg-linear-to-br from-slate-900 to-slate-950 shadow-2xl p-8 border border-amber-500/40 rounded-2xl w-full max-w-md">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="bg-amber-500/15 p-2 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-bold text-white text-base">
                  Secret Key Issued
                </h3>
              </div>
              <p className="ml-9.5 text-slate-400 text-xs">
                Save these credentials immediately — they won&apos;t be shown
                again
              </p>
            </div>
            <div className="space-y-3 bg-slate-950/50 -mx-8 px-8 py-4 border-slate-800/50 border-t border-b rounded-lg">
              <div className="space-y-2">
                <p className="font-semibold text-[10px] text-slate-500 uppercase tracking-wide">
                  App Identifier
                </p>
                <div className="group flex justify-between items-center gap-2 bg-slate-950 p-3 border border-slate-700/50 hover:border-indigo-500/30 rounded-lg transition">
                  <p className="flex-1 font-mono text-indigo-300 text-sm break-all select-all">
                    {secretModalData.appId}
                  </p>
                  <button
                    onClick={() =>
                      handleCopy(secretModalData.appId, "modal-appid")
                    }
                    className={`ml-2 px-3 py-1.5 rounded-lg font-semibold text-[11px] transition shrink-0 whitespace-nowrap ${copiedField === "modal-appid" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30"}`}
                  >
                    {copiedField === "modal-appid" ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-[10px] text-slate-500 uppercase tracking-wide">
                  Secret Key
                </p>
                <div className="group flex justify-between items-center gap-2 bg-slate-950 p-3 border border-slate-700/50 hover:border-emerald-500/30 rounded-lg transition">
                  <p className="flex-1 font-mono text-emerald-400 text-sm break-all select-all">
                    {secretModalData.secretKey}
                  </p>
                  <button
                    onClick={() =>
                      handleCopy(secretModalData.secretKey, "modal-secret")
                    }
                    className={`ml-2 px-3 py-1.5 rounded-lg font-semibold text-[11px] transition shrink-0 whitespace-nowrap ${copiedField === "modal-secret" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30"}`}
                  >
                    {copiedField === "modal-secret" ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSecretModalData(null)}
              className="bg-amber-600/20 hover:bg-amber-600/30 py-2.5 border border-amber-500/30 hover:border-amber-500/50 rounded-lg w-full font-semibold text-amber-200 text-xs transition"
            >
              I have saved my credentials
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
