import { useCallback, useState } from "react";

import { NotebookEditor } from "../features/editor/NotebookEditor.tsx";
import { NotebookSidebar } from "../features/notebooks/NotebookSidebar.tsx";
import { useNotebooks } from "../features/notebooks/useNotebooks.ts";
import { SettingsSheet } from "../features/settings/SettingsSheet.tsx";
import { useSettings } from "../features/settings/useSettings.ts";
import { AppShell } from "./AppShell.tsx";
import { EmptyState } from "./EmptyState.tsx";

export default function App() {
  // Reconciles Dexie with the pre-paint mirror and applies theme changes live.
  const settings = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { notebooks, activeId, select, create, rename, setPinned, remove, reorder } =
    useNotebooks();
  const active = notebooks.find((notebook) => notebook.id === activeId) ?? null;

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
          <NotebookEditor key={active.id} notebook={active} />
        ) : (
          <section className="mx-auto flex w-full max-w-[72ch] flex-col gap-1 p-6">
            <p className="text-sm text-on-surface-variant">Select a notebook to continue.</p>
          </section>
        )}
      </AppShell>
      <SettingsSheet open={settingsOpen} settings={settings} onClose={closeSettings} />
    </>
  );
}
