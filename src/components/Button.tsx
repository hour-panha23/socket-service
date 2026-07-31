import { ButtonHTMLAttributes, forwardRef, RefObject } from "react";
import { cn } from "../lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success"
  | "danger"
  | "info"
  | "warning";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: RefObject<HTMLButtonElement | null> | null;
};

const variantClassMap: Record<ButtonVariant, string[]> = {
  primary: [
    "bg-accent text-accent-foreground border-accent",
    "shadow-sm shadow-accent/20",
    "hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-sm active:scale-[0.98]",
  ],

  secondary: [
    "bg-surface-muted text-foreground border-border",
    "hover:bg-surface hover:border-border-strong hover:-translate-y-0.5",
    "active:translate-y-0 active:scale-[0.98]",
  ],

  outline: [
    "bg-transparent text-foreground border-border",
    "hover:bg-surface-muted hover:border-border-strong hover:-translate-y-0.5",
    "active:translate-y-0 active:scale-[0.98]",
  ],

  ghost: [
    "bg-transparent text-foreground border-transparent",
    "hover:bg-surface-muted",
    "active:bg-surface active:scale-[0.98]",
  ],

  destructive: [
    "bg-destructive text-white border-destructive",
    "shadow-sm shadow-destructive/20",
    "hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/30 hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-sm active:scale-[0.98]",
  ],

  success: [
    "bg-success text-foreground border-success",
    "shadow-sm shadow-success/20",
    "hover:bg-success/90 hover:shadow-lg hover:shadow-success/30 hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-sm active:scale-[0.98]",
  ],

  danger: [
    "bg-danger text-foreground border-danger",
    "shadow-sm shadow-danger/20",
    "hover:bg-danger/90 hover:shadow-lg hover:shadow-danger/30 hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-sm active:scale-[0.98]",
  ],

  info: [
    "bg-info text-foreground border-info",
    "shadow-sm shadow-info/20",
    "hover:bg-info/90 hover:shadow-lg hover:shadow-info/30 hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-sm active:scale-[0.98]",
  ],

  warning: [
    "bg-warning text-foreground border-warning",
    "shadow-sm shadow-warning/20",
    "hover:bg-warning/90 hover:shadow-lg hover:shadow-warning/30 hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-sm active:scale-[0.98]",
  ],
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref} // ✅ Attach forwarded ref
        type={type}
        onClick={(e) => {
          e.stopPropagation();
          props.onClick?.(e);
        }}
        className={cn(
          "inline-flex justify-center items-center gap-2 border rounded-lg font-semibold transition-all duration-200 ease-out cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-60",
          variantClassMap[variant],
          sizeClassMap[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
