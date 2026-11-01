import type { Accent, Theme } from "../data/models.ts";

/** Resolve the stored preference against the OS; OLED is only ever explicit. */
export function resolveTheme(stored: Theme | null, systemDark: boolean): Theme {
  if (stored !== null) {
    return stored;
  }

  return systemDark ? "dark" : "light";
}

/** Apply a resolved theme and accent to the document root. */
export function applyTheme(theme: Theme, accent: Accent): void {
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.dataset.accent = accent;
  root.style.colorScheme = theme === "light" ? "light" : "dark";
}
