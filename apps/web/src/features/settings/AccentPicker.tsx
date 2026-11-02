import { useId } from "react";

import type { Accent, Theme } from "../../data/models.ts";
import { ACCENTS } from "../../data/settings.ts";
import { CheckIcon } from "../../ui/icons.tsx";

const ACCENT_LABELS: Record<Accent, string> = {
  blue: "Blue",
  teal: "Teal",
  green: "Green",
  orange: "Orange",
  rose: "Rose",
  violet: "Violet",
};

export type AccentPickerProps = {
  value: Accent;
  /** Scopes each preview swatch to the generated tokens for that theme. */
  resolvedTheme: Theme;
  onChange: (accent: Accent) => void;
};

export function AccentPicker({ value, resolvedTheme, onChange }: AccentPickerProps) {
  const name = useId();

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 text-sm font-medium text-on-surface">Accent</legend>
      <div className="grid grid-cols-2 gap-2">
        {ACCENTS.map((accent) => (
          <label
            key={accent}
            className="flex h-12 cursor-pointer items-center gap-2 rounded-button border border-outline px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container has-[:checked]:border-primary has-[:checked]:bg-primary-container has-[:checked]:text-on-primary-container has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
          >
            <input
              type="radio"
              name={name}
              value={accent}
              checked={value === accent}
              onChange={() => {
                onChange(accent);
              }}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              data-theme={resolvedTheme}
              data-accent={accent}
              className="h-5 w-5 shrink-0 rounded-full border border-outline bg-primary"
            />
            <span className="min-w-0 flex-1 truncate text-start">{ACCENT_LABELS[accent]}</span>
            <CheckIcon className="hidden h-4 w-4 shrink-0 peer-checked:block" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
