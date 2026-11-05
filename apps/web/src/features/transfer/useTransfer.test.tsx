import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { createBackup, type Backup } from "../../data/backup.ts";
import type { Notebook, Settings } from "../../data/models.ts";
import { useTransfer, type TransferDeps } from "./useTransfer.ts";

const SETTINGS: Settings = { theme: "dark", accent: "teal", defaultIgnoreCase: true };

function makeNotebook(overrides: Partial<Notebook> = {}): Notebook {
  return {
    id: crypto.randomUUID(),
    title: "Draft",
    lines: [{ id: crypto.randomUUID(), text: "first line" }],
    pinned: false,
    ignoreCase: false,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

// jsdom's File has no reliable text() in every environment; the hook only
// needs that one method.
function backupFile(backup: Backup): File {
  const file = new File([JSON.stringify(backup)], "inlign-backup.json", {
    type: "application/json",
  });

  Object.defineProperty(file, "text", { value: () => Promise.resolve(JSON.stringify(backup)) });

  return file;
}

function makeDeps(overrides: Partial<TransferDeps> = {}): TransferDeps {
  return {
    create: vi.fn(),
    replaceAll: vi.fn(async () => {}),
    getNotebooks: () => [],
    getSettings: () => SETTINGS,
    getLines: () => undefined,
    setTheme: vi.fn(() => Promise.resolve(true)),
    setAccent: vi.fn(() => Promise.resolve(true)),
    setDefaultIgnoreCase: vi.fn(() => Promise.resolve(true)),
    cancelPendingWrites: vi.fn(),
    ...overrides,
  };
}

async function loadAndApply(deps: TransferDeps, backup: Backup, mode: "replace" | "add" | "merge") {
  const { result } = renderHook(() => useTransfer(deps));

  await act(async () => {
    await result.current.importBackupFile(backupFile(backup));
  });

  expect(result.current.pendingBackup).not.toBeNull();

  await act(async () => {
    await result.current.applyBackup(mode);
  });

  return result;
}

test("cancels the pending editor write before a replace transaction", async () => {
  const imported = makeNotebook({ title: "Imported" });
  const calls: string[] = [];
  const deps = makeDeps({
    cancelPendingWrites: () => calls.push("cancel"),
    replaceAll: vi.fn(() => {
      calls.push("replaceAll");

      return Promise.resolve();
    }),
  });

  const result = await loadAndApply(deps, createBackup([imported], SETTINGS), "replace");

  expect(calls).toEqual(["cancel", "replaceAll"]);
  expect(deps.replaceAll).toHaveBeenCalledWith([imported]);
  expect(result.current.error).toBeNull();
  expect(result.current.pendingBackup).toBeNull();
});

test("reports a settings persistence failure after the notebooks were restored", async () => {
  const imported = makeNotebook({ title: "Imported" });
  const deps = makeDeps({
    setTheme: vi.fn(() => Promise.resolve(false)),
  });

  const result = await loadAndApply(deps, createBackup([imported], SETTINGS), "replace");

  expect(deps.replaceAll).toHaveBeenCalled();
  expect(deps.setAccent).toHaveBeenCalledWith("teal");
  expect(deps.setDefaultIgnoreCase).toHaveBeenCalledWith(true);
  expect(result.current.error).toBe(
    "Notebooks were restored, but the app settings could not be saved.",
  );
});

test("cancels before add and keeps the unsaved current text", async () => {
  const imported = makeNotebook({ title: "Imported" });
  const current = makeNotebook({ title: "Current" });
  const unsaved = [{ id: current.lines[0]!.id, text: "not saved yet" }];
  const calls: string[] = [];
  const deps = makeDeps({
    getNotebooks: () => [current],
    getLines: () => unsaved,
    cancelPendingWrites: () => calls.push("cancel"),
    replaceAll: vi.fn(() => {
      calls.push("replaceAll");

      return Promise.resolve();
    }),
  });

  await loadAndApply(deps, createBackup([imported], SETTINGS), "add");

  expect(calls).toEqual(["cancel", "replaceAll"]);
  expect(deps.replaceAll).toHaveBeenCalledWith([
    expect.objectContaining({ title: "Imported" }),
    expect.objectContaining({ id: current.id, lines: unsaved }),
  ]);
});

test("cancels before merge", async () => {
  const imported = makeNotebook({ title: "Imported" });
  const calls: string[] = [];
  const deps = makeDeps({
    cancelPendingWrites: () => calls.push("cancel"),
    replaceAll: vi.fn(() => {
      calls.push("replaceAll");

      return Promise.resolve();
    }),
  });

  await loadAndApply(deps, createBackup([imported], SETTINGS), "merge");

  expect(calls).toEqual(["cancel", "replaceAll"]);
  expect(deps.replaceAll).toHaveBeenCalledWith([imported]);
});
