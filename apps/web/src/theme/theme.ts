import type { Accent, Theme } from "../data/models.ts";

/**
 * Browser-chrome colours per resolved theme. This is theme source, not a
 * component: the hex values mirror the neutral tokens in tokens.css.
 */
export const THEME_COLORS: Record<Theme, string> = {
  light: "#fffbfe",
  dark: "#1c1b1f",
  oled: "#000000",
};

/** Resolve the stored preference against the OS; OLED is only ever explicit. */
export function resolveTheme(stored: Theme | null, systemDark: boolean): Theme {
  if (stored !== null) {
    return stored;
  }

  return systemDark ? "dark" : "light";
}

/** Apply a resolved theme and accent to the document root and browser chrome. */
export function applyTheme(theme: Theme, accent: Accent): void {
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.dataset.accent = accent;
  root.style.colorScheme = theme === "light" ? "light" : "dark";

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }

  meta.content = THEME_COLORS[theme];
}
