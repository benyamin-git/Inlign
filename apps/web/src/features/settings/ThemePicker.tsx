import { useId } from "react";

import type { Theme } from "../../data/models.ts";
import { THEMES } from "../../data/settings.ts";
import { CheckIcon } from "../../ui/icons.tsx";

const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  oled: "OLED",
};

export type ThemePickerProps = {
  /** The stored preference; null follows the OS. */
  value: Theme | null;
  /** The theme currently applied, used to mark the first-run choice. */
  resolvedTheme: Theme;
  onChange: (theme: Theme) => void;
};

export function ThemePicker({ value, resolvedTheme, onChange }: ThemePickerProps) {
  const name = useId();
  const selected = value ?? resolvedTheme;

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 text-sm font-medium text-on-surface">Theme</legend>
      <div className="grid grid-cols-3 overflow-hidden rounded-button border border-outline">
        {THEMES.map((theme) => (
          <label
            key={theme}
            className="flex h-12 cursor-pointer items-center justify-center gap-1.5 border-e border-outline px-2 text-sm text-on-surface-variant transition-colors last:border-e-0 hover:bg-surface-container has-[:checked]:bg-primary-container has-[:checked]:text-on-primary-container has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-primary"
          >
            <input
              type="radio"
              name={name}
              value={theme}
              checked={selected === theme}
              onClick={() => {
                // A checked radio fires no native change, so the resolved
                // first-run choice needs an explicit click to become pinned.
                if (value === null && theme === resolvedTheme) {
                  onChange(theme);
                }
              }}
              onChange={() => {
                onChange(theme);
              }}
              className="peer sr-only"
            />
            <CheckIcon className="hidden h-4 w-4 shrink-0 peer-checked:block" />
            <span>{THEME_LABELS[theme]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
