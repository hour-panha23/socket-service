"use client";

import { Project } from "@/src/services/project/project.types";
import { AlertTriangle, KeyRound, ShieldAlert, X } from "lucide-react";
import React, { useEffect, useState } from "react";

interface RegenerateSecretModalProps {
  project: Project | null;
  isLoading: boolean;
  onConfirm: (id: string) => void;
  onClose: () => void;
}

export const RegenerateSecretModal: React.FC<RegenerateSecretModalProps> = ({
  project,
  isLoading,
  onConfirm,
  onClose,
}) => {
  const [confirmName, setConfirmName] = useState("");

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, onClose]);

  if (!project) return null;

  const isConfirmed = confirmName.trim() === project.name;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmed && !isLoading) {
      onConfirm(project.id);
    }
  };

  return (
    <div
      className="z-50 fixed inset-0 flex justify-center items-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in duration-200 fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="relative space-y-5 bg-slate-900 shadow-2xl p-6 border border-rose-500/30 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Top Accent Line */}
        <div className="top-0 absolute inset-x-0 bg-linear-to-r from-rose-500 via-amber-500 to-rose-500 h-1" />

        {/* Header */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-rose-500/10 p-2.5 border border-rose-500/20 rounded-xl text-rose-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">
                Regenerate Secret Key
              </h3>
              <p className="text-[11px] text-slate-400">
                Breaking action for integration credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="hover:bg-slate-800 disabled:opacity-50 p-1 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Callout */}
        <div className="space-y-2 bg-rose-950/30 p-3.5 border border-rose-500/20 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-rose-400 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Immediate Service Impact</span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            The active secret key for{" "}
            <strong className="font-bold text-white">{project.name}</strong>{" "}
            will be revoked instantly. Any application using this key will fail
            authentication immediately.
          </p>
        </div>

        {/* Form with Security Confirmation */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1.5 font-medium text-[11px] text-slate-300">
              Type{" "}
              <span className="selection:bg-rose-900 font-mono text-rose-400">
                {project.name}
              </span>{" "}
              to confirm:
            </label>
            <input
              type="text"
              required
              disabled={isLoading}
              placeholder={project.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="bg-slate-950 p-2.5 border border-slate-800 focus:border-rose-500 rounded-xl focus:outline-none w-full font-mono text-slate-200 placeholder:text-slate-600 text-xs transition"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!isConfirmed || isLoading}
              className="inline-flex flex-1 justify-center items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 shadow-lg shadow-rose-950/50 py-2.5 border border-rose-500/40 disabled:border-slate-800 rounded-xl font-semibold text-white disabled:text-slate-500 text-xs transition cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="border-2 border-white/30 border-t-white rounded-full w-3.5 h-3.5 animate-spin" />
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Regenerate Key</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 py-2.5 border border-slate-700/60 rounded-xl font-semibold text-slate-300 text-xs transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
