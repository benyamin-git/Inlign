import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "./cx.ts";

export type IconButtonProps = Omit<ComponentPropsWithRef<"button">, "aria-label"> & {
  /** Accessible name; icon buttons have no visible text. */
  label: string;
  children: ReactNode;
};

export function IconButton({ label, className, type, children, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      className={cx(
        "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-button text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:w-10",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
