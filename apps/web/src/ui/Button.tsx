import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "./cx.ts";

export type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "destructive";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  compact?: boolean;
  children: ReactNode;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  filled: "bg-primary text-on-primary hover:bg-primary/90",
  tonal: "bg-surface-container-high text-on-surface hover:bg-surface-container-high/80",
  outlined:
    "border border-outline bg-surface-container text-on-surface hover:bg-surface-container-high",
  text: "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
  destructive: "bg-loss text-background hover:bg-loss/90",
};

export function Button({
  variant = "filled",
  compact = false,
  className,
  type,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(
        "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-button text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 md:h-10",
        compact ? "px-2" : "px-4",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
