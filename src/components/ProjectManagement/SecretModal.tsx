"use client";

import { Check, Copy, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface SecretModalData {
  projectId: string;
  secretKey: string;
}

interface SecretModalProps {
  data: SecretModalData | null;
  onClose: () => void;
}

export const SecretModal: React.FC<SecretModalProps> = ({ data, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [hasConfirmedSave, setHasConfirmedSave] = useState(false);

  // Close on Escape key only if user confirmed saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && hasConfirmedSave) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasConfirmedSave, onClose]);

  if (!data) return null;

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

  const handleCopyAll = () => {
    const combined = `PROJECT_ID=${data.projectId}\nSECRET_KEY=${data.secretKey}`;
    navigator.clipboard.writeText(combined);
    setCopiedField("modal-all");
    toast.success("Both credentials copied!", {
      duration: 2000,
      position: "bottom-center",
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in duration-200 fade-in">
      <div className="relative space-y-5 bg-linear-to-br from-slate-900 via-slate-900 to-slate-950 shadow-2xl p-6 sm:p-8 border border-amber-500/40 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Top Accent Line */}
        <div className="top-0 absolute inset-x-0 bg-linear-to-r from-amber-500 via-yellow-400 to-amber-500 h-1" />

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500/15 p-2 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base tracking-tight">
              Secret Key Issued
            </h3>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Save these credentials immediately. For security reasons, the secret
            key will{" "}
            <span className="font-semibold text-amber-300">
              never be displayed again
            </span>
            .
          </p>
        </div>

        {/* Credentials Box */}
        <div className="space-y-4 bg-slate-950/70 -mx-6 sm:-mx-8 px-6 sm:px-8 py-5 border-slate-800/80 border-t border-b">
          {/* Quick Copy All Action */}
          <div className="flex justify-between items-center">
            <span className="font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
              API Credentials
            </span>
            <button
              type="button"
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 font-medium text-[11px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
            >
              {copiedField === "modal-all" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied Both!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy (.env format)</span>
                </>
              )}
            </button>
          </div>

          {/* Project ID */}
          <div className="space-y-1.5">
            <label className="block font-medium text-[11px] text-slate-400">
              Project Identifier
            </label>
            <div className="group flex justify-between items-center gap-2 bg-slate-900 p-2.5 border border-slate-800 focus-within:border-indigo-500/50 rounded-xl transition">
              <p className="flex-1 font-mono text-indigo-300 text-xs break-all select-all">
                {data.projectId}
              </p>
              <button
                type="button"
                onClick={() => handleCopy(data.projectId, "modal-projectid")}
                className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] transition shrink-0 whitespace-nowrap cursor-pointer ${
                  copiedField === "modal-projectid"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30"
                }`}
              >
                {copiedField === "modal-projectid" ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Secret Key */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block font-medium text-[11px] text-slate-400">
                Secret Key
              </label>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                {showSecret ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Hide
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" /> Reveal
                  </>
                )}
              </button>
            </div>
            <div className="group flex justify-between items-center gap-2 bg-slate-900 p-2.5 border border-slate-800 focus-within:border-emerald-500/50 rounded-xl transition">
              <p className="flex-1 font-mono text-emerald-400 text-xs break-all select-all">
                {showSecret ? data.secretKey : "•".repeat(32)}
              </p>
              <button
                type="button"
                onClick={() => handleCopy(data.secretKey, "modal-secret")}
                className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] transition shrink-0 whitespace-nowrap cursor-pointer ${
                  copiedField === "modal-secret"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30"
                }`}
              >
                {copiedField === "modal-secret" ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        {/* Safety Confirmation Checkbox */}
        <label className="group flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={hasConfirmedSave}
            onChange={(e) => setHasConfirmedSave(e.target.checked)}
            className="bg-slate-950 checked:bg-amber-500 mt-0.5 border-slate-700 rounded focus:ring-amber-500/50 text-amber-500 accent-amber-500 cursor-pointer"
          />
          <span className="text-slate-300 group-hover:text-white text-xs leading-snug transition">
            I have backed up this secret key in a secure location (e.g. password
            manager or <code className="text-amber-300">.env</code>).
          </span>
        </label>

        {/* Dismiss Button */}
        <button
          type="button"
          disabled={!hasConfirmedSave}
          onClick={onClose}
          className="flex justify-center items-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 disabled:opacity-40 py-2.5 border border-amber-500/30 hover:border-amber-500/50 disabled:border-slate-800 rounded-xl w-full font-semibold text-amber-200 disabled:text-slate-500 text-xs transition cursor-pointer disabled:cursor-not-allowed"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>I have saved my credentials</span>
        </button>
      </div>
    </div>
  );
};
