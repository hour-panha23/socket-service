"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  FolderKanban,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { logger } from "@/src/lib/logger";
import {
  deleteProject,
  disableProject,
  enableProject,
  listProject,
  regenerateSecret,
} from "@/src/services/project/project.service";

import { Project } from "@/src/services/project/project.types";
import AlertDialog, { AlertDialogState } from "../AlertDialog";
import { ProjectModal } from "./ProjectModal";
import { RegenerateSecretModal } from "./RegenerateSecretModal";
import { SecretModal } from "./SecretModal";

export const ProjectManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{ is_active?: boolean }>({
    is_active: undefined,
  });

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [alertDialog, setAlertDialog] = useState<AlertDialogState | null>(null);
  const [selectProject, setSelectProject] = useState<Project | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingRegenerateProject, setPendingRegenerateProject] =
    useState<Project | null>(null);
  const [secretModalData, setSecretModalData] = useState<{
    projectId: string;
    secretKey: string;
  } | null>(null);

  const {
    data: projects,
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
        data: (response?.data?.data as Project[]) || [],
        total: response?.data?.total || 0,
        total_page: response?.data?.total_page || 1,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  const projectsList: Project[] = projects?.data || [];

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? enableProject(id) : disableProject(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["list-project"] });
      toast.success(
        `Project ${variables.active ? "enabled" : "disabled"} successfully`,
      );
    },
    onError: (err, variables) => {
      logger.error(err);
      toast.error(
        `Failed to ${variables.active ? "enable" : "disable"} project`,
        {
          description: err instanceof Error ? err.message : "Please try again",
        },
      );
    },
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: (id: string) => regenerateSecret(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["list-project"] });
      setPendingRegenerateProject(null);
      toast.success("Secret key regenerated", {
        description: "Your new secret key is displayed below",
      });
      if (data?.data?.secret_key)
        setSecretModalData({
          projectId: data?.data?.project_id,
          secretKey: data?.data?.secret_key,
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
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["list-project"] });
      toast.success("Project deleted successfully", {
        description: `${data?.data?.name || "Project"} is now deleted`,
      });
      setAlertDialog(null);
      setSelectProject(null);
    },
    onError: (err) => {
      logger.error(err);
      toast.error("Failed to delete project", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    },
  });

  const handleOpenCreate = () => {
    setSelectProject(null);
    setIsCreateOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setSelectProject(project);
    setIsCreateOpen(true);
  };

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

  const handleDelete = (project: Project) => {
    setSelectProject(project);
    setAlertDialog({
      isOpen: true,
      variant: "danger",
      title: "Delete Project",
      description: (
        <>
          Are you sure you want to delete{" "}
          <strong className="font-extrabold text-white">{project.name}</strong>?
        </>
      ),
      showCancelButton: true,
      confirmLabel: "Delete",
      onConfirm: () => {
        deleteMutation.mutate(project.id);
      },
      onCancel: () => {
        setAlertDialog(null);
        setSelectProject(null);
      },
    });
  };

  return (
    <div className="bg-slate-950 px-8 py-2 w-full min-h-full font-sans text-slate-100">
      <div className="space-y-6 mx-auto">
        {/* Standardised Header */}
        <div className="flex sm:flex-row flex-col justify-between sm:items-center gap-4 pb-6 border-slate-800 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-950/50 p-2.5 border border-indigo-500/20 rounded-xl shrink-0">
              <FolderKanban className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-bold text-white text-2xl tracking-tight">
                Project Management
              </h1>
              <p className="mt-0.5 text-slate-400 text-xs">
                Manage credentials, Project IDs, and Secret Keys for registered
                projects.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-indigo-600/20 shadow-sm px-4 py-2.5 rounded-lg font-semibold text-white text-xs transition duration-200 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Register Project
          </button>
        </div>

        {/* Standardised Toolbar & Filter Controls */}
        <div className="flex sm:flex-row flex-col justify-between items-stretch sm:items-center gap-3 bg-slate-900/80 shadow-md p-4 border border-slate-800 rounded-xl">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="top-1/2 left-3 absolute w-4 h-4 text-slate-400 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects by name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 py-2 pr-8 pl-9 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none w-full text-slate-200 placeholder:text-slate-500 text-xs transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="top-1/2 right-3 absolute text-slate-500 hover:text-slate-300 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg">
            <button
              onClick={() => setFilters({ is_active: undefined })}
              className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                filters.is_active === undefined
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilters({ is_active: true })}
              className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                filters.is_active === true
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilters({ is_active: false })}
              className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                filters.is_active === false
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Standardised Table */}
        <div className="bg-slate-900/60 shadow-xl border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/80 border-slate-800 border-b font-mono text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4">Project</th>
                  <th className="p-4">Project ID</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-slate-400 text-center">
                      <div className="flex justify-center items-center gap-2 font-mono text-xs">
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                        Loading registered projects...
                      </div>
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 font-mono text-rose-400 text-xs text-center"
                    >
                      Error loading projects: {(error as Error).message}
                    </td>
                  </tr>
                ) : projectsList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 font-mono text-slate-400 text-xs text-center italic"
                    >
                      No matching projects found.
                    </td>
                  </tr>
                ) : (
                  projectsList.map((project) => {
                    const projectIdCopyId = `project-${project.id}`;
                    return (
                      <tr
                        key={project.id}
                        className="hover:bg-slate-800/50 transition"
                      >
                        <td className="p-4">
                          <p className="font-semibold text-slate-100 text-sm">
                            {project.name}
                          </p>
                          <p className="mt-0.5 text-slate-400 text-xs">
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
                              className="bg-slate-800 hover:bg-slate-700 px-2 py-0.5 border border-slate-700 rounded text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
                            >
                              {copiedField === projectIdCopyId
                                ? "Copied!"
                                : "Copy"}
                            </button>
                          </div>
                        </td>

                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: project.id,
                                active: !project.is_active,
                              })
                            }
                            disabled={toggleActiveMutation.isPending}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer ${
                              project.is_active
                                ? "bg-emerald-500"
                                : "bg-slate-700"
                            }`}
                          >
                            <span
                              className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                                project.is_active
                                  ? "translate-x-5"
                                  : "translate-x-1"
                              }`}
                            >
                              {project.is_active ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                              ) : (
                                <X className="w-2.5 h-2.5 text-slate-500" />
                              )}
                            </span>
                          </button>
                        </td>

                        <td className="p-4 font-mono text-slate-400 text-xs">
                          {project.created_at}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end items-center gap-1">
                            <button
                              onClick={() => handleEditProject(project)}
                              title="Edit Project"
                              className="hover:bg-slate-800 p-2 border border-transparent hover:border-slate-700/80 rounded-lg text-slate-400 hover:text-indigo-400 transition cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              title="Regenerate Secret"
                              onClick={() =>
                                setPendingRegenerateProject(project)
                              }
                              className="hover:bg-slate-800 p-2 border border-transparent hover:border-slate-700/80 rounded-lg text-slate-400 hover:text-amber-400 transition cursor-pointer"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                              title="Delete Project"
                              onClick={() => handleDelete(project)}
                              className="hover:bg-rose-950/40 p-2 border border-transparent hover:border-rose-800/30 rounded-lg text-slate-400 hover:text-rose-400 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        <ProjectModal
          key={selectProject?.id || "create-project-modal"}
          isOpen={isCreateOpen}
          project={selectProject}
          onClose={() => {
            setIsCreateOpen(false);
            setSelectProject(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["list-project"] });
            setIsCreateOpen(false);
            setSelectProject(null);
          }}
        />

        <RegenerateSecretModal
          project={pendingRegenerateProject}
          isLoading={regenerateSecretMutation.isPending}
          onConfirm={(id) => regenerateSecretMutation.mutate(id)}
          onClose={() => setPendingRegenerateProject(null)}
        />

        <AlertDialog
          isOpen={alertDialog?.isOpen || false}
          variant={alertDialog?.variant || "error"}
          title={alertDialog?.title || ""}
          description={alertDialog?.description || ""}
          showCancelButton={alertDialog?.showCancelButton ?? true}
          confirmLabel={alertDialog?.confirmLabel || "OK"}
          isLoading={deleteMutation.isPending}
          onConfirm={() => {
            if (alertDialog?.onConfirm) {
              alertDialog.onConfirm();
            }
          }}
          onCancel={() => {
            if (alertDialog?.onCancel) {
              alertDialog.onCancel();
            } else {
              setAlertDialog(null);
              setSelectProject(null);
            }
          }}
          onClose={() => {
            setAlertDialog(null);
            setSelectProject(null);
          }}
        />

        <SecretModal
          data={secretModalData}
          onClose={() => setSecretModalData(null)}
        />
      </div>
    </div>
  );
};

export default ProjectManagement;
