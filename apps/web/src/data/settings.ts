import { db, type SettingRecord } from "./db.ts";
import type { Accent, Settings, Theme } from "./models.ts";

const DEFAULT_SETTINGS: Settings = { theme: null, accent: "blue" };

export const THEMES = ["light", "dark", "oled"] as const satisfies readonly Theme[];
export const ACCENTS = [
  "blue",
  "teal",
  "green",
  "orange",
  "rose",
  "violet",
] as const satisfies readonly Accent[];

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

export function isAccent(value: unknown): value is Accent {
  return (ACCENTS as readonly unknown[]).includes(value);
}

export async function getSettings(): Promise<Settings> {
  const records = await db.settings.toArray();
  const settings: Settings = { ...DEFAULT_SETTINGS };

  for (const record of records) {
    if (record.key === "theme" && isTheme(record.value)) {
      settings.theme = record.value;
    }

    if (record.key === "accent" && isAccent(record.value)) {
      settings.accent = record.value;
    }
  }

  return settings;
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  const record: SettingRecord = { key, value };

  await db.settings.put(record);
}
