import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "./cx.ts";

export type ButtonVariant = "filled" | "tonal" | "text" | "destructive";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  filled: "bg-primary text-on-primary hover:bg-primary/90",
  tonal: "bg-surface-container-high text-on-surface hover:bg-surface-container-high/80",
  text: "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
  destructive: "bg-loss text-background hover:bg-loss/90",
};

export function Button({ variant = "filled", className, type, children, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(
        "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-button px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 md:h-10",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
