import { useId } from "react";
import type { ComponentPropsWithRef } from "react";

import { cx } from "./cx.ts";

export type FieldProps = ComponentPropsWithRef<"input"> & {
  /** Always rendered, or visually hidden for inline edits. */
  label: string;
  hideLabel?: boolean;
};

export function Field({ label, hideLabel = false, id, className, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        htmlFor={inputId}
        className={hideLabel ? "sr-only" : "text-xs font-medium text-on-surface-variant"}
      >
        {label}
      </label>
      <input
        id={inputId}
        className={cx(
          "h-12 w-full min-w-0 rounded-chip border border-outline bg-surface px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 md:h-10",
          className,
        )}
        {...props}
      />
    </div>
  );
}
