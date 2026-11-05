import { expect, test } from "vitest";

import { BackupError, createBackup, mergeBackup, parseBackup, withFreshIds } from "./backup.ts";
import type { Notebook, Settings } from "./models.ts";

const SETTINGS: Settings = { theme: "dark", accent: "teal", defaultIgnoreCase: true };

function makeNotebook(overrides: Partial<Notebook> = {}): Notebook {
  return {
    id: crypto.randomUUID(),
    title: "Draft",
    lines: [{ id: crypto.randomUUID(), text: "first line" }],
    pinned: false,
    ignoreCase: false,
    sortOrder: 0,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function backupWith(notebooks: Notebook[], settings: Settings = SETTINGS) {
  return createBackup(notebooks, settings);
}

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(BackupError);
    return (error as Error).message;
  }

  throw new Error("Expected a BackupError");
}

test("round-trips a backup through parseBackup with the full domain shape", () => {
  const notebook = makeNotebook({
    title: "Pinned notes",
    pinned: true,
    sortOrder: -3,
    lines: [
      { id: crypto.randomUUID(), text: "alpha" },
      { id: crypto.randomUUID(), text: "" },
    ],
  });
  const backup = backupWith([notebook], {
    theme: null,
    accent: "violet",
    defaultIgnoreCase: false,
  });

  expect(backup.format).toBe("inlign-backup");
  expect(backup.version).toBe(1);
  expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
  expect(parseBackup(backup)).toEqual(backup);
  expect(parseBackup(parseBackup(backup))).toEqual(backup);
});

test("an empty notebook list is a valid backup", () => {
  const backup = backupWith([]);

  expect(parseBackup(backup).notebooks).toEqual([]);
});

test("old backups without case settings default them to case-sensitive", () => {
  const backup = backupWith([makeNotebook()]);
  const legacy = structuredClone(backup) as unknown as {
    settings: Record<string, unknown>;
    notebooks: Record<string, unknown>[];
  };

  delete legacy.settings.defaultIgnoreCase;
  delete legacy.notebooks[0]!.ignoreCase;

  const parsed = parseBackup(legacy);

  expect(parsed.settings.defaultIgnoreCase).toBe(false);
  expect(parsed.notebooks[0]?.ignoreCase).toBe(false);
});

test("creates an independent snapshot of notebooks and settings", () => {
  const notebook = makeNotebook();
  const settings: Settings = { theme: "dark", accent: "teal", defaultIgnoreCase: false };
  const backup = backupWith([notebook], settings);

  notebook.title = "Changed";
  notebook.lines[0]!.text = "Changed";
  settings.accent = "rose";

  expect(backup.notebooks[0]?.title).toBe("Draft");
  expect(backup.notebooks[0]?.lines[0]?.text).toBe("first line");
  expect(backup.settings.accent).toBe("teal");
});

test.each([
  ["format", { format: "other-backup" }],
  ["version", { version: 2 }],
  ["missing exportedAt", { exportedAt: undefined }],
  ["non-ISO exportedAt", { exportedAt: "yesterday" }],
  ["missing settings", { settings: undefined }],
  ["unknown theme", { settings: { theme: "sepia", accent: "blue" } }],
  ["unknown accent", { settings: { theme: "dark", accent: "pink" } }],
])("rejects a backup with %s", (_label, patch) => {
  const backup = { ...backupWith([makeNotebook()]), ...patch };

  expect(() => parseBackup(backup)).toThrow(BackupError);
});

test("rejects a notebook with no lines and names the problem in the message", () => {
  const backup = backupWith([makeNotebook({ lines: [] })]);

  const message = messageOf(() => parseBackup(backup));

  expect(message).toContain("Invalid backup file");
  expect(message).toContain("notebooks.0.lines");
  expect(message).toContain("at least one line");
});

test("rejects duplicate line ids within a notebook", () => {
  const lineId = crypto.randomUUID();
  const backup = backupWith([
    makeNotebook({
      lines: [
        { id: lineId, text: "first" },
        { id: lineId, text: "second" },
      ],
    }),
  ]);

  const message = messageOf(() => parseBackup(backup));

  expect(message).toContain("notebooks.0.lines");
  expect(message).toContain(`Duplicate line id ${lineId}`);
});

test("rejects an invalid notebook id, title length and numeric fields", () => {
  const invalidId = backupWith([makeNotebook({ id: "not-a-uuid" })]);

  expect(messageOf(() => parseBackup(invalidId))).toContain("notebooks.0.id");

  const longTitle = backupWith([makeNotebook({ title: "x".repeat(121) })]);

  expect(messageOf(() => parseBackup(longTitle))).toContain("notebooks.0.title");

  const badOrder = backupWith([makeNotebook({ sortOrder: Number.NaN })]);

  expect(messageOf(() => parseBackup(badOrder))).toContain("notebooks.0.sortOrder");
});

test("withFreshIds clones notebook and line ids without touching the source", () => {
  const notebook = makeNotebook({
    title: "Keep",
    pinned: true,
    sortOrder: 4,
    lines: [
      { id: crypto.randomUUID(), text: "one" },
      { id: crypto.randomUUID(), text: "two" },
    ],
  });
  const backup = backupWith([notebook]);
  const fresh = withFreshIds(backup);
  const freshNotebook = fresh.notebooks[0]!;

  expect(freshNotebook.id).not.toBe(notebook.id);
  expect(freshNotebook.lines.map((line) => line.id)).not.toEqual(
    notebook.lines.map((line) => line.id),
  );
  expect(new Set(freshNotebook.lines.map((line) => line.id)).size).toBe(2);
  expect(freshNotebook).toMatchObject({
    title: "Keep",
    pinned: true,
    sortOrder: 4,
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
  });
  expect(freshNotebook.lines.map((line) => line.text)).toEqual(["one", "two"]);
  expect(backup.notebooks[0]).not.toBe(notebook);
  expect(backup.notebooks[0]).toEqual(notebook);
});

test("merge keeps unknown notebooks, updates matching ids and adds missing ones", () => {
  const kept = makeNotebook({ title: "Kept" });
  const replacedLocal = makeNotebook({ title: "Local title" });
  const importedReplacement = {
    ...replacedLocal,
    title: "Imported title",
    lines: [{ id: crypto.randomUUID(), text: "imported line" }],
    updatedAt: 9,
  };
  const added = makeNotebook({ title: "Added" });

  const merged = mergeBackup([kept, replacedLocal], [importedReplacement, added]);

  expect(merged.map((notebook) => notebook.id)).toEqual([kept.id, replacedLocal.id, added.id]);
  expect(merged[0]).toBe(kept);
  expect(merged[1]).toBe(importedReplacement);
  expect(merged[2]).toBe(added);
  expect(merged.find((notebook) => notebook.id === kept.id)?.title).toBe("Kept");
});

test("replace uses only the imported records", () => {
  const current = [makeNotebook({ title: "Current" })];
  const imported = [
    makeNotebook({ title: "Imported one" }),
    makeNotebook({ title: "Imported two" }),
  ];
  const parsed = parseBackup(backupWith(imported));

  expect(parsed.notebooks.map((notebook) => notebook.title)).toEqual([
    "Imported one",
    "Imported two",
  ]);
  expect(parsed.notebooks.some((notebook) => current.some((item) => item.id === notebook.id))).toBe(
    false,
  );
});
