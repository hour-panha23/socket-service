"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Plus, ShieldCheck, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { apiClient, FetchJsonConfig } from "../lib/apiClient";
import { logger } from "../lib/logger";
import { listProject } from "../services/project/project.service";
import { ActionMenu } from "./ActionMenu";

interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

export type ProjectItem = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  secret_key?: string;
};

async function fetchJson<T>(url: string, config?: FetchJsonConfig): Promise<T> {
  const response = await apiClient.request<ApiResponse<T>>({
    url,
    ...config,
  });
  return response.data.data;
}
export const ProjectManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    is_active: false,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [pendingRegenerateProject, setPendingRegenerateProject] =
    useState<ProjectItem | null>(null);
  const [secretModalData, setSecretModalData] = useState<{
    projectId: string;
    secretKey: string;
  } | null>(null);

  const {
    data: projectsResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["list-project", searchTerm, filters, page, limit],
    queryFn: async () => {
      const response = await listProject({
        search: searchTerm || undefined,
        filters: {
          is_active: filters.is_active,
        },
        page,
        limit,
      });

      return {
        data: response.data || [],
        total: response.limit || 0,
        total_page: response.total_page || 1,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  const createMutation = useMutation({
    mutationFn: (newProject: { name: string; description?: string }) =>
      fetchJson<ProjectItem>("/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["project"] });
      setIsCreateOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      toast.success("Project created successfully", {
        description: `${data.name} is now ready to use`,
      });
      if (data.secret_key)
        setSecretModalData({
          projectId: data.project_id,
          secretKey: data.secret_key,
        });
    },
    onError: (err) => {
      logger.error(err);
      toast.error("Failed to create project", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      fetchJson<ProjectItem>(
        `/projects/${id}/${active ? "enable" : "disable"}`,
        {
          method: "PATCH",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project"] });
      toast.success("Project status updated successfully");
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
      fetchJson<ProjectItem>(`/projects/${id}/regenerate-secret`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["project"] });
      setPendingRegenerateProject(null);
      toast.success("Secret key regenerated", {
        description: "Your new secret key is displayed below",
      });
      if (data.secret_key)
        setSecretModalData({
          projectId: data.project_id,
          secretKey: data.secret_key,
        });
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
      fetchJson<void>(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project"] });
      toast.success("Project deleted successfully");
    },
    onError: (err) => {
      logger.error(err);
      toast.error("Failed to delete project", {
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

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    createMutation.mutate({
      name: newProjectName,
      description: newProjectDesc || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-slate-800/60 border-b">
        <div>
          <h2 className="font-bold text-white text-xl tracking-tight">
            Project Management
          </h2>
          <p className="mt-0.5 text-slate-400 text-xs">
            Manage credentials, Project IDs, and Secret Keys for registered
            projects.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 shadow-sm px-4 py-2 rounded-lg font-semibold text-white text-xs transition"
        >
          <Plus className="w-4 h-4" /> Register Project
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 shadow-xl border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900/90 border-slate-800 border-b font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="p-4">Projectlication</th>
              <th className="p-4">Project ID</th>
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
                  Loading registered projects...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="p-8 text-rose-400 text-center">
                  Error loading projects: {(error as Error).message}
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-slate-500 text-center italic"
                >
                  No projects registered yet.
                </td>
              </tr>
            ) : (
              projects.map((project) => {
                const projectIdCopyId = `project-${project.id}`;
                return (
                  <tr
                    key={project.id}
                    className="hover:bg-slate-800/20 transition"
                  >
                    <td className="p-4">
                      <p className="font-semibold text-slate-100">
                        {project.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {project.description || "No description"}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 font-mono text-indigo-300 text-xs">
                        <span>{project.project_id}</span>
                        <button
                          onClick={() =>
                            handleCopy(project.project_id, projectIdCopyId)
                          }
                          className="bg-slate-800 hover:bg-slate-700 px-2 py-0.5 border border-slate-700 rounded text-[11px] text-slate-300 hover:text-white transition"
                        >
                          {copiedField === projectIdCopyId ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </td>

                    {/* FLIP-FLOP TOGGLE WITH INTERNAL TEXT */}
                    <td className="p-4">
                      <button
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: project.id,
                            active: !project.is_active,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                          project.is_active ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                            project.is_active
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        >
                          {project.is_active ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <X className="w-3 h-3 text-slate-500" />
                          )}
                        </span>
                      </button>
                    </td>

                    <td className="p-4 font-mono text-slate-400 text-xs">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <ActionMenu
                        project={project}
                        onToggleActive={(id, active) =>
                          toggleActiveMutation.mutate({ id, active })
                        }
                        onRegenerateSecret={() =>
                          setPendingRegenerateProject(project)
                        }
                        onDelete={() => deleteMutation.mutate(project.id)}
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
              Projectlication
            </h3>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="block mb-1 font-medium text-[11px] text-slate-300">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Learning Hub"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
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
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
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
                    : "Create Projectlication"}
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
      {pendingRegenerateProject && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="space-y-4 bg-slate-900 shadow-2xl p-6 border border-rose-500/30 rounded-xl w-full max-w-md">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm">Regenerate Secret Key</h3>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              This invalidates the current secret key immediately for{" "}
              <span className="font-semibold text-white">
                {pendingRegenerateProject.name}
              </span>
              . Continue?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={regenerateSecretMutation.isPending}
                onClick={() =>
                  regenerateSecretMutation.mutate(pendingRegenerateProject.id)
                }
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 py-2 rounded-lg font-semibold text-white text-xs transition"
              >
                {regenerateSecretMutation.isPending
                  ? "Regenerating..."
                  : "Regenerate Key"}
              </button>
              <button
                type="button"
                onClick={() => setPendingRegenerateProject(null)}
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
                  Project Identifier
                </p>
                <div className="group flex justify-between items-center gap-2 bg-slate-950 p-3 border border-slate-700/50 hover:border-indigo-500/30 rounded-lg transition">
                  <p className="flex-1 font-mono text-indigo-300 text-sm break-all select-all">
                    {secretModalData.projectId}
                  </p>
                  <button
                    onClick={() =>
                      handleCopy(secretModalData.projectId, "modal-projectid")
                    }
                    className={`ml-2 px-3 py-1.5 rounded-lg font-semibold text-[11px] transition shrink-0 whitespace-nowrap ${copiedField === "modal-projectid" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30"}`}
                  >
                    {copiedField === "modal-projectid" ? "✓ Copied!" : "Copy"}
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
