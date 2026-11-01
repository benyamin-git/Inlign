import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import type { Accent, Settings, Theme } from "../data/models.ts";
import { getSettings, isAccent, isTheme, setSetting } from "../data/settings.ts";
import { applyTheme, resolveTheme } from "./theme.ts";

export const THEME_STORAGE_KEY = "inlign.theme";
export const ACCENT_STORAGE_KEY = "inlign.accent";

const DEFAULT_ACCENT: Accent = "blue";

export type UseTheme = {
  /** The stored preference; null follows the OS. */
  theme: Theme | null;
  /** The theme actually applied, after resolving a null preference. */
  resolvedTheme: Theme;
  accent: Accent;
  setTheme: (theme: Theme | null) => Promise<void>;
  setAccent: (accent: Accent) => Promise<void>;
};

function prefersDark(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => {};
  }

  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);

  return () => {
    query.removeEventListener("change", onChange);
  };
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // The mirror is only a pre-paint optimisation; Dexie remains the source.
  }
}

function readMirroredTheme(): Theme | null {
  const stored = readStorage(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : null;
}

function readMirroredAccent(): Accent {
  const stored = readStorage(ACCENT_STORAGE_KEY);
  return isAccent(stored) ? stored : DEFAULT_ACCENT;
}

function mirror(settings: Settings): void {
  // A null theme follows the OS, so no concrete theme is mirrored: removing
  // the key lets the next pre-paint follow the OS as it stands then.
  writeStorage(THEME_STORAGE_KEY, settings.theme);
  writeStorage(ACCENT_STORAGE_KEY, settings.accent);
}

export function useTheme(): UseTheme {
  // Seeded from the mirror so the first render agrees with the pre-paint
  // script; Dexie then reconciles both the state and the mirror.
  const [theme, setThemeState] = useState<Theme | null>(readMirroredTheme);
  const [accent, setAccentState] = useState<Accent>(readMirroredAccent);
  // Following the OS is a live subscription, so returning to `theme: null`
  // picks up the current preference instead of the one at mount.
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, prefersDark, () => false);

  const resolvedTheme = resolveTheme(theme, systemDark);

  useEffect(() => {
    let active = true;

    getSettings().then(
      (settings) => {
        if (!active) {
          return;
        }

        setThemeState(settings.theme);
        setAccentState(settings.accent);
        mirror(settings);
      },
      () => {
        // Dexie is unavailable; keep the mirrored preference for this session.
      },
    );

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme, accent);
  }, [resolvedTheme, accent]);

  const setTheme = useCallback(async (next: Theme | null) => {
    setThemeState(next);
    writeStorage(THEME_STORAGE_KEY, next);
    await setSetting("theme", next);
  }, []);

  const setAccent = useCallback(async (next: Accent) => {
    setAccentState(next);
    writeStorage(ACCENT_STORAGE_KEY, next);
    await setSetting("accent", next);
  }, []);

  return { theme, resolvedTheme, accent, setTheme, setAccent };
}
