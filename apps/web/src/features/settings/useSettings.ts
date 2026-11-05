import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { Accent, Theme } from "../../data/models.ts";
import { getSettings, isAccent, isTheme, setSetting } from "../../data/settings.ts";
import { applyTheme, resolveTheme } from "../../theme/theme.ts";

export const THEME_STORAGE_KEY = "inlign.theme";
export const ACCENT_STORAGE_KEY = "inlign.accent";

const DEFAULT_ACCENT: Accent = "blue";

export type SettingsModel = {
  /** The stored preference; null follows the OS. */
  theme: Theme | null;
  /** The theme actually applied, after resolving a null preference. */
  resolvedTheme: Theme;
  accent: Accent;
  /** Whether new notebooks start with case-insensitive variable names. */
  defaultIgnoreCase: boolean;
  setTheme: (theme: Theme | null) => Promise<boolean>;
  setAccent: (accent: Accent) => Promise<boolean>;
  setDefaultIgnoreCase: (value: boolean) => Promise<boolean>;
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

/**
 * Loads settings, applies the theme live and persists every change. The
 * localStorage mirror is seeded before the first render so the app agrees with
 * the pre-paint script; Dexie then reconciles it as the source of truth.
 */
export function useSettings(): SettingsModel {
  const [theme, setThemeState] = useState<Theme | null>(readMirroredTheme);
  const [accent, setAccentState] = useState<Accent>(readMirroredAccent);
  const [defaultIgnoreCase, setDefaultIgnoreCaseState] = useState(false);
  // Following the OS is a live subscription, so returning to `theme: null`
  // picks up the current preference instead of the one at mount.
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, prefersDark, () => false);
  // The initial Dexie read can finish after the user has already picked a
  // value. Each field is reconciled only while it is still untouched, so a
  // slow load never overwrites a newer choice.
  const touchedTheme = useRef(false);
  const touchedAccent = useRef(false);
  const touchedDefaultIgnoreCase = useRef(false);

  const resolvedTheme = resolveTheme(theme, systemDark);

  useEffect(() => {
    let active = true;

    getSettings().then(
      (settings) => {
        if (!active) {
          return;
        }

        if (!touchedTheme.current) {
          setThemeState(settings.theme);
          writeStorage(THEME_STORAGE_KEY, settings.theme);
        }

        if (!touchedAccent.current) {
          setAccentState(settings.accent);
          writeStorage(ACCENT_STORAGE_KEY, settings.accent);
        }

        if (!touchedDefaultIgnoreCase.current) {
          setDefaultIgnoreCaseState(settings.defaultIgnoreCase);
        }
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

  const setTheme = useCallback(async (next: Theme | null): Promise<boolean> => {
    touchedTheme.current = true;
    setThemeState(next);
    writeStorage(THEME_STORAGE_KEY, next);

    try {
      await setSetting("theme", next);

      return true;
    } catch {
      // Persistence failed; the session keeps the new preference.
      return false;
    }
  }, []);

  const setAccent = useCallback(async (next: Accent): Promise<boolean> => {
    touchedAccent.current = true;
    setAccentState(next);
    writeStorage(ACCENT_STORAGE_KEY, next);

    try {
      await setSetting("accent", next);

      return true;
    } catch {
      // Persistence failed; the session keeps the new preference.
      return false;
    }
  }, []);

  const setDefaultIgnoreCase = useCallback(async (next: boolean): Promise<boolean> => {
    touchedDefaultIgnoreCase.current = true;
    setDefaultIgnoreCaseState(next);

    try {
      await setSetting("defaultIgnoreCase", next);

      return true;
    } catch {
      // Persistence failed; the session keeps the new preference.
      return false;
    }
  }, []);

  return {
    theme,
    resolvedTheme,
    accent,
    defaultIgnoreCase,
    setTheme,
    setAccent,
    setDefaultIgnoreCase,
  };
}
