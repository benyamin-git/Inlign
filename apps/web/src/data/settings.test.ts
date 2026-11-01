import { afterAll, beforeEach, expect, test } from "vitest";

import { db } from "./db.ts";
import type { Theme } from "./models.ts";
import { getSettings, setSetting } from "./settings.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterAll(() => {
  db.close();
});

test("returns defaults when nothing is stored", async () => {
  await expect(getSettings()).resolves.toEqual({ theme: null, accent: "blue" });
});

test("round-trips theme and accent settings", async () => {
  await setSetting("theme", "oled");
  await setSetting("accent", "rose");

  await expect(getSettings()).resolves.toEqual({ theme: "oled", accent: "rose" });
});

test("stores a null theme to follow the OS again", async () => {
  await setSetting("theme", "dark");
  await setSetting("theme", null);
  await setSetting("accent", "teal");

  await expect(getSettings()).resolves.toEqual({ theme: null, accent: "teal" });
});

test("ignores an invalid stored theme", async () => {
  await db.settings.put({ key: "theme", value: "neon" as unknown as Theme });

  await expect(getSettings()).resolves.toEqual({ theme: null, accent: "blue" });
});
