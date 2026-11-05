import { useCallback, useEffect, useRef, useState } from "react";

import type { Line, Notebook } from "../data/models.ts";
import { EngineClient } from "../engine/client.ts";
import { NotebookEditor } from "../features/editor/NotebookEditor.tsx";
import { NotebookSidebar } from "../features/notebooks/NotebookSidebar.tsx";
import { useNotebooks } from "../features/notebooks/useNotebooks.ts";
import { SettingsSheet } from "../features/settings/SettingsSheet.tsx";
import { useSettings } from "../features/settings/useSettings.ts";
import { ImportDialog } from "../features/transfer/ImportDialog.tsx";
import { useTransfer } from "../features/transfer/useTransfer.ts";
import { AppShell } from "./AppShell.tsx";
import { EmptyState } from "./EmptyState.tsx";

export default function App() {
  // Reconciles Dexie with the pre-paint mirror and applies theme changes live.
  const settings = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [engine, setEngine] = useState<EngineClient | null>(null);

  // Creating the client during render would leave a disposed instance behind
  // when StrictMode mounts, unmounts and mounts the app again.
  useEffect(() => {
    if (typeof Worker === "undefined") {
      return;
    }

    const client = new EngineClient();
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setEngine(client);
      }
    });

    return () => {
      cancelled = true;
      client.dispose();
      setEngine((current) => (current === client ? null : current));
    };
  }, []);

  const {
    notebooks,
    activeId,
    revision,
    select,
    create,
    rename,
    setPinned,
    remove,
    reorder,
    replaceAll,
  } = useNotebooks();
  const active = notebooks.find((notebook) => notebook.id === activeId) ?? null;
  // The sidebar list is not refreshed on text edits, so keep the editor's
  // latest lines here for exports and restores without re-rendering the cards.
  const editorLinesRef = useRef(new Map<string, Line[]>());
  // The open editor registers its autosave cancel here; a restore calls it
  // before touching storage so a pending text write cannot undo the import.
  const cancelPendingWritesRef = useRef<(() => void) | null>(null);
  const registerCancelPendingWrites = useCallback((cancel: (() => void) | null) => {
    cancelPendingWritesRef.current = cancel;
  }, []);
  const cancelPendingWrites = useCallback(() => {
    cancelPendingWritesRef.current?.();
  }, []);
  const getNotebooks = useCallback(() => notebooks, [notebooks]);
  const getLines = useCallback((id: string) => editorLinesRef.current.get(id), []);
  const getSettings = useCallback(
    () => ({ theme: settings.theme, accent: settings.accent }),
    [settings.theme, settings.accent],
  );

  // A restore replaces stored lines, so cached editor snapshots are stale until
  // the open editor reloads from the repository.
  useEffect(() => {
    editorLinesRef.current.clear();
  }, [revision]);

  const transfer = useTransfer({
    create,
    replaceAll,
    getNotebooks,
    getSettings,
    getLines,
    setTheme: settings.setTheme,
    setAccent: settings.setAccent,
    cancelPendingWrites,
  });
  const { exportNotebook: downloadNotebook } = transfer;

  const exportNotebook = useCallback(
    (notebook: Notebook) => {
      downloadNotebook({
        ...notebook,
        lines: editorLinesRef.current.get(notebook.id) ?? notebook.lines,
      });
    },
    [downloadNotebook],
  );

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  return (
    <>
      <AppShell
        activeTitle={active?.title ?? null}
        onOpenSettings={openSettings}
        sidebar={({ onNavigate, onClose }) => (
          <NotebookSidebar
            notebooks={notebooks}
            activeId={activeId}
            onSelect={select}
            onCreate={create}
            onRename={rename}
            onSetPinned={setPinned}
            onDelete={remove}
            onReorder={reorder}
            onExport={exportNotebook}
            onNavigate={onNavigate}
            onClose={onClose}
          />
        )}
      >
        {notebooks.length === 0 ? (
          <EmptyState
            onCreate={() => {
              void create().catch(() => {
                // IndexedDB is unavailable; the empty state stays in place.
              });
            }}
          />
        ) : active ? (
          <NotebookEditor
            key={active.id}
            notebook={active}
            revision={revision}
            engine={engine}
            onLinesChange={(lines) => {
              editorLinesRef.current.set(active.id, lines);
            }}
            registerCancelPendingWrites={registerCancelPendingWrites}
          />
        ) : (
          <section className="mx-auto flex w-full max-w-[72ch] flex-col gap-1 p-6">
            <p className="text-sm text-on-surface-variant">Select a notebook to continue.</p>
          </section>
        )}
      </AppShell>
      <SettingsSheet
        open={settingsOpen}
        settings={settings}
        active={active}
        onExport={exportNotebook}
        transfer={transfer}
        onClose={closeSettings}
      />
      <ImportDialog
        key={transfer.pendingBackup?.exportedAt ?? "closed"}
        open={transfer.pendingBackup !== null}
        backup={transfer.pendingBackup}
        busy={transfer.busy}
        error={transfer.error}
        onCancel={transfer.cancelBackup}
        onExportBackup={transfer.exportBackup}
        onApply={transfer.applyBackup}
      />
    </>
  );
}
