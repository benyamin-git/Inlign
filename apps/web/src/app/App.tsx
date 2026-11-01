import { useCallback } from "react";

import { NotebookSidebar } from "../features/notebooks/NotebookSidebar.tsx";
import { useNotebooks } from "../features/notebooks/useNotebooks.ts";
import { useTheme } from "../theme/useTheme.ts";
import { AppShell } from "./AppShell.tsx";
import { EmptyState } from "./EmptyState.tsx";

export default function App() {
  // Reconciles Dexie with the pre-paint mirror; the picker lands with settings.
  useTheme();

  const { notebooks, activeId, select, create, rename, setPinned, remove, reorder } =
    useNotebooks();
  const active = notebooks.find((notebook) => notebook.id === activeId) ?? null;

  const handleCreate = useCallback(() => {
    void create();
  }, [create]);

  const lineLabel = active
    ? `${String(active.lines.length)} ${active.lines.length === 1 ? "line" : "lines"}`
    : "";

  return (
    <AppShell
      activeTitle={active?.title ?? null}
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
      {active ? (
        <section className="mx-auto flex w-full max-w-[72ch] flex-col gap-1 p-6">
          <h2 className="text-lg font-semibold text-on-surface">{active.title}</h2>
          <p className="text-sm text-on-surface-variant">
            {lineLabel}. Card editing is not available yet.
          </p>
        </section>
      ) : (
        <EmptyState onCreate={handleCreate} />
      )}
    </AppShell>
  );
}
