import { db } from "./db.ts";
import type { Accent, Settings, Theme } from "./models.ts";

const DEFAULT_SETTINGS: Settings = { theme: null, accent: "blue" };

const THEMES: readonly Theme[] = ["light", "dark", "oled"];
const ACCENTS: readonly Accent[] = ["blue", "teal", "green", "orange", "rose", "violet"];

function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value);
}

function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((accent) => accent === value);
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
  await db.settings.put({ key, value });
}
