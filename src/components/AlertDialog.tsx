import {
  AlertCircle,
  AlertTriangle,
  Check,
  HelpCircle,
  Info,
  LogOut,
  X,
} from "lucide-react";
import React, { ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { Button, ButtonVariant } from "./Button";

export type AlertDialogVariant =
  | "info"
  | "error"
  | "warning"
  | "confirm"
  | "success"
  | "logout"
  | "danger";

export type AlertDialogState = {
  isOpen: boolean;
  title: string;
  variant: AlertDialogVariant;
  description: React.ReactNode;
  showCancelButton?: boolean;
  closeOnClickOutside?: boolean;
  confirmLabel: string;
  retryLabel?: string;
  cancelLabel?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
};

type AlertDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  variant?: AlertDialogVariant;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  isLoading?: boolean;
  children?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  showCancelButton?: boolean;
  closeOnClickOutside?: boolean;
};

const variantStyles: Record<
  AlertDialogVariant,
  {
    icon: ReactNode;
    headerBg: string;
    variant: ButtonVariant;
    confirmBtnClass: string;
  }
> = {
  info: {
    icon: <Info className="w-5 h-5 text-indigo-400" />,
    variant: "primary",
    headerBg: "bg-indigo-600/10 border-b border-indigo-500/20",
    confirmBtnClass:
      "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20",
  },
  error: {
    icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
    headerBg: "bg-rose-500/10 border-b border-rose-500/20",
    variant: "danger",
    confirmBtnClass:
      "bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/20",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    headerBg: "bg-amber-500/10 border-b border-amber-500/20",
    variant: "warning",
    confirmBtnClass:
      "bg-amber-600 text-white hover:bg-amber-500 shadow-amber-600/20",
  },
  confirm: {
    icon: <HelpCircle className="w-5 h-5 text-indigo-400" />,
    headerBg: "bg-indigo-600/10 border-b border-indigo-500/20",
    variant: "primary",
    confirmBtnClass:
      "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20",
  },
  success: {
    icon: <Check className="w-5 h-5 text-emerald-400" />,
    headerBg: "bg-emerald-500/10 border-b border-emerald-500/20",
    variant: "success",
    confirmBtnClass:
      "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20",
  },
  logout: {
    icon: <LogOut className="w-5 h-5 text-rose-400" />,
    headerBg: "bg-rose-500/10 border-b border-rose-500/20",
    variant: "danger",
    confirmBtnClass:
      "bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/20",
  },
  danger: {
    icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
    headerBg: "bg-rose-500/10 border-b border-rose-500/20",
    variant: "danger",
    confirmBtnClass:
      "bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/20",
  },
};

const defaultLabels: Record<AlertDialogVariant, string> = {
  info: "OK",
  error: "OK",
  warning: "Understood",
  confirm: "Confirm",
  success: "Great",
  logout: "Logout",
  danger: "Confirm",
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AlertDialog({
  isOpen,
  onClose,
  title,
  description,
  variant = "info",
  onConfirm,
  confirmLabel,
  cancelLabel = "Cancel",
  onCancel,
  isLoading = false,
  children,
  retryLabel = "Retry",
  showCancelButton = true,
  onRetry,
  closeOnClickOutside = true,
}: AlertDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Mount/unmount lifecycle so exit animation can play before removal
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const ANIM_MS = 180;

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldRender(true);
      // next tick so the "enter" classes apply after mount (triggers transition)
      requestAnimationFrame(() => setIsClosing(false));
    } else if (shouldRender) {
      setIsClosing(true);
      const t = setTimeout(() => setShouldRender(false), ANIM_MS);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Body scroll lock + keyboard handling + focus trap
  useEffect(() => {
    if (!shouldRender) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // autofocus the confirm button when the dialog mounts
    const focusTimer = setTimeout(() => confirmBtnRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        onConfirm ? onConfirm() : onClose();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown, true);
      clearTimeout(focusTimer);
    };
  }, [shouldRender, onClose, onConfirm]);

  if (!shouldRender) return null;

  const style = variantStyles[variant];
  const hasCancelButton =
    variant === "confirm" || variant === "error" || !!onCancel;
  const hasRetryButton = !!onRetry;

  const handleConfirmClick = () => {
    if (onConfirm) {
      onConfirm();
      return;
    }
    onClose();
  };

  return createPortal(
    <div
      className={cn(
        "z-50 fixed inset-0 flex justify-center items-center bg-slate-950/80 backdrop-blur-sm p-4 transition-opacity duration-200",
        isClosing ? "opacity-0" : "opacity-100 animate-fadeIn",
      )}
      onClick={
        closeOnClickOutside ? onClose : (event) => event.preventDefault()
      }
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          "relative flex flex-col bg-slate-900 shadow-2xl border border-slate-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden transition-all duration-200",
          isClosing
            ? "opacity-0 scale-95"
            : "opacity-100 scale-100 animate-scale-up",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {/* 1. HEADER */}
        <div
          className={cn(
            "flex justify-between items-center p-4 shrink-0",
            style.headerBg,
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {style.icon}
            <h3
              id={titleId}
              className="font-bold text-white text-sm truncate tracking-tight"
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex justify-center items-center hover:bg-slate-800/80 rounded-lg w-7 h-7 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. BODY */}
        <div className="flex-1 bg-slate-900 p-5 overflow-y-auto">
          {description && (
            <p
              id={descId}
              className="text-slate-300 text-xs sm:text-sm leading-relaxed"
            >
              {description}
            </p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>

        {/* 3. FOOTER */}
        <div className="flex flex-wrap justify-end gap-2 bg-slate-900/90 px-5 py-3.5 border-slate-800/80 border-t shrink-0">
          {hasCancelButton && showCancelButton && (
            <button
              type="button"
              onClick={onCancel || onClose}
              disabled={isLoading}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-4 py-2 rounded-lg font-semibold text-slate-300 text-xs transition cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}

          {hasRetryButton && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-4 py-2 rounded-lg font-semibold text-slate-300 text-xs transition cursor-pointer"
            >
              {retryLabel}
            </button>
          )}

          <Button
            type="button"
            className={cn(
              "flex justify-center items-center gap-2 px-4 py-2 border-0 rounded-lg font-semibold text-xs transition cursor-pointer",
              style.confirmBtnClass,
            )}
            onClick={handleConfirmClick}
            disabled={isLoading}
            variant={style.variant}
            ref={confirmBtnRef}
          >
            {isLoading && (
              <svg
                className="w-3.5 h-3.5 text-current animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            <span>{confirmLabel ?? defaultLabels[variant]}</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
