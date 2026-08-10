"use client";

import { logger } from "@/src/lib/logger";
import {
  createProject,
  updateProject,
} from "@/src/services/project/project.service";
import { Project } from "@/src/services/project/project.types";
import { Pencil, ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import AlertDialog, { AlertDialogState } from "../AlertDialog";

interface ProjectModalProps {
  isOpen: boolean;
  project?: Project | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  project,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(project?.id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorDialog, setErrorDialog] = useState<AlertDialogState | null>(null);

  useEffect(() => {
    if (project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(project.name || "");
      setDescription(project.description || "");
      setWebhookUrl(project.webhook_url || "");
    } else {
      setName("");
      setDescription("");
      setWebhookUrl("");
    }
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter project name");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        webhook_url: webhookUrl.trim() || "",
      };

      const res =
        isEdit && project
          ? await updateProject(project.id, payload)
          : await createProject(payload);

      if (res.status_code !== 200 && res.status_code !== 201) {
        setErrorDialog({
          isOpen: true,
          title: "Error",
          variant: "error",
          description:
            res.message || `Failed to ${isEdit ? "update" : "create"} project`,
          confirmLabel: "OK",
          onConfirm: () => setErrorDialog(null),
        });
        return;
      }

      toast.success(`Project ${isEdit ? "updated" : "created"} successfully`, {
        description: `${res?.data?.name || name} is ready to use`,
      });

      handleClose();
      onSuccess();
    } catch (err) {
      logger.error(err);
      setErrorDialog({
        isOpen: true,
        title: "Error",
        variant: "error",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
        confirmLabel: "OK",
        onConfirm: () => setErrorDialog(null),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrorDialog(null);
    setName("");
    setDescription("");
    setWebhookUrl("");
    onClose();
  };

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center bg-slate-100/10 backdrop-blur-xs p-4">
      <div className="space-y-4 bg-slate-900 shadow-2xl p-6 border border-slate-800 rounded-xl w-full max-w-md animate-scale-up">
        <h3 className="flex items-center gap-2 font-bold text-white text-sm">
          {isEdit ? (
            <>
              <Pencil className="w-4 h-4 text-indigo-400" /> Edit Project
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> Register New
              Project
            </>
          )}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block mb-1 font-medium text-[11px] text-slate-300">
              Project Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Learning Hub"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950 p-2 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none w-full text-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-[11px] text-slate-300">
              Webhook URL
            </label>
            <input
              type="text"
              placeholder="e.g. https://webhook.site/1234567890"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-950 p-2 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none w-full text-slate-200 text-xs"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 rounded-lg font-semibold text-white text-xs transition cursor-pointer"
            >
              {loading
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create Project"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg font-semibold text-slate-300 text-xs transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <AlertDialog
        isOpen={errorDialog?.isOpen || false}
        variant={errorDialog?.variant || "error"}
        title={errorDialog?.title || ""}
        description={errorDialog?.description || ""}
        showCancelButton={false}
        confirmLabel={errorDialog?.confirmLabel || "OK"}
        onConfirm={() => setErrorDialog(null)}
        onClose={() => setErrorDialog(null)}
      />
    </div>
  );
};
