import { useId } from "react";

import { CheckIcon } from "./icons.tsx";

export type CheckboxProps = {
  label: string;
  description?: string | undefined;
  checked: boolean;
  disabled?: boolean | undefined;
  onChange: (checked: boolean) => void;
};

/**
 * A labelled checkbox with a 48px touch row. The native input stays in the
 * accessibility tree and keyboard order while the visible box carries focus.
 */
export function Checkbox({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: CheckboxProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-chip py-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 md:min-h-10">
      <span className="relative mt-0.5 h-5 w-5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-describedby={description === undefined ? undefined : descriptionId}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-chip border border-outline bg-surface text-on-primary-container peer-checked:border-primary peer-checked:bg-primary-container peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
        />
        <CheckIcon className="pointer-events-none absolute inset-0 m-auto hidden h-4 w-4 text-on-primary-container peer-checked:block" />
      </span>
      <span className="min-w-0">
        <span id={labelId} className="block text-sm font-medium text-on-surface">
          {label}
        </span>
        {description === undefined ? null : (
          <span id={descriptionId} className="mt-1 block text-xs text-on-surface-variant">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
