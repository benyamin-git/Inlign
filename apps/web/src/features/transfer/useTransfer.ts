import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

import {
  BackupError,
  createBackup,
  mergeBackup,
  parseBackup,
  withFreshIds,
  type Backup,
} from "../../data/backup.ts";
import type { Accent, Line, Notebook, Settings, Theme } from "../../data/models.ts";
import { parseInlign, serializeInlign, slugify } from "../../data/transfer.ts";
import { downloadFile } from "../../lib/download.ts";
import type { UseNotebooks } from "../notebooks/useNotebooks.ts";

export const BACKUP_FILENAME = "inlign-backup.json";

export type ImportMode = "add" | "merge" | "replace";

export type TransferDeps = {
  create: UseNotebooks["create"];
  replaceAll: UseNotebooks["replaceAll"];
  /** Current notebooks in sidebar order; text may lag the open editor. */
  getNotebooks: () => Notebook[];
  getSettings: () => Settings;
  getLines: (notebookId: string) => Line[] | undefined;
  setTheme: (theme: Theme | null) => Promise<boolean>;
  setAccent: (accent: Accent) => Promise<boolean>;
  /** Drops the open editor's debounced write before storage is replaced. */
  cancelPendingWrites: () => void;
};

export type TransferModel = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  backupInputRef: RefObject<HTMLInputElement | null>;
  error: string | null;
  busy: boolean;
  pendingBackup: Backup | null;
  chooseImportFile: () => void;
  importFile: (file: File) => Promise<void>;
  exportNotebook: (notebook: Notebook) => void;
  chooseBackupFile: () => void;
  importBackupFile: (file: File) => Promise<void>;
  exportBackup: () => boolean;
  cancelBackup: () => void;
  applyBackup: (mode: ImportMode) => Promise<void>;
};

function resetInput(ref: RefObject<HTMLInputElement | null>): void {
  if (ref.current) {
    ref.current.value = "";
  }
}

export function useTransfer({
  create,
  replaceAll,
  getNotebooks,
  getSettings,
  getLines,
  setTheme,
  setAccent,
  cancelPendingWrites,
}: TransferDeps): TransferModel {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<Backup | null>(null);
  // Merge and add restore the current records too, so include text that the
  // editor has not autosaved yet.
  const currentNotebooks = useCallback(
    () =>
      getNotebooks().map((notebook) => ({
        ...notebook,
        lines: getLines(notebook.id) ?? notebook.lines,
      })),
    [getNotebooks, getLines],
  );

  const chooseImportFile = useCallback(() => {
    setError(null);
    fileInputRef.current?.click();
  }, []);

  const importFile = useCallback(
    async (file: File): Promise<void> => {
      setBusy(true);
      setError(null);

      try {
        const fallbackTitle = file.name.replace(/\.[^.]+$/, "");
        const parsed = parseInlign(await file.text(), fallbackTitle);

        await create(parsed.title, parsed.lines);
      } catch {
        setError(`Could not import ${file.name}. Check that it is an .inlign text file.`);
      } finally {
        setBusy(false);
        resetInput(fileInputRef);
      }
    },
    [create],
  );

  const exportNotebook = useCallback((notebook: Notebook): void => {
    setError(null);

    try {
      downloadFile(`${slugify(notebook.title)}.inlign`, serializeInlign(notebook));
    } catch {
      setError(`Could not export ${notebook.title}.`);
    }
  }, []);

  const chooseBackupFile = useCallback(() => {
    setError(null);
    backupInputRef.current?.click();
  }, []);

  const importBackupFile = useCallback(async (file: File): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      const raw: unknown = JSON.parse(await file.text());

      setPendingBackup(parseBackup(raw));
    } catch (error) {
      setError(
        error instanceof BackupError
          ? error.message
          : `Could not import ${file.name}. Check that it is an Inlign JSON backup.`,
      );
    } finally {
      setBusy(false);
      resetInput(backupInputRef);
    }
  }, []);

  const exportBackup = useCallback((): boolean => {
    setError(null);

    try {
      const backup = createBackup(currentNotebooks(), getSettings());

      downloadFile(BACKUP_FILENAME, JSON.stringify(backup, null, 2), "application/json");

      return true;
    } catch {
      setError("Could not export a backup.");
      return false;
    }
  }, [currentNotebooks, getSettings]);

  const cancelBackup = useCallback(() => {
    setPendingBackup(null);
    setError(null);
  }, []);

  const applyBackup = useCallback(
    async (mode: ImportMode): Promise<void> => {
      const backup = pendingBackup;

      if (!backup) {
        return;
      }

      // Cancel before any await so the debounced write cannot land between the
      // replace and the editor's revision reload (or its unmount flush).
      cancelPendingWrites();
      setBusy(true);
      setError(null);

      try {
        if (mode === "replace") {
          // Notebooks and settings live in separate Dexie tables, so this is a
          // notebook transaction followed by the settings write, not one
          // atomic restore. The safety backup already covers the whole app.
          await replaceAll(backup.notebooks);
          setPendingBackup(null);

          const [themeSaved, accentSaved] = await Promise.allSettled([
            setTheme(backup.settings.theme),
            setAccent(backup.settings.accent),
          ]);
          const saved = (result: PromiseSettledResult<boolean>): boolean =>
            result.status === "fulfilled" && result.value;

          if (!saved(themeSaved) || !saved(accentSaved)) {
            setError("Notebooks were restored, but the theme and accent could not be saved.");
          }
        } else {
          const current = currentNotebooks();
          const next =
            mode === "add"
              ? [...withFreshIds(backup).notebooks, ...current]
              : mergeBackup(current, backup.notebooks);

          await replaceAll(next);
          setPendingBackup(null);
        }
      } catch {
        setError("Could not restore the backup. Your current notebooks were not changed.");
      } finally {
        setBusy(false);
      }
    },
    [pendingBackup, replaceAll, currentNotebooks, setTheme, setAccent, cancelPendingWrites],
  );

  return {
    fileInputRef,
    backupInputRef,
    error,
    busy,
    pendingBackup,
    chooseImportFile,
    importFile,
    exportNotebook,
    chooseBackupFile,
    importBackupFile,
    exportBackup,
    cancelBackup,
    applyBackup,
  };
}
