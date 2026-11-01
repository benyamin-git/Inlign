import { useCallback, useEffect, useRef } from "react";

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
  const activeHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterCreateRef = useRef(false);

  const handleCreate = useCallback(() => {
    focusAfterCreateRef.current = true;
    void create().catch(() => {
      focusAfterCreateRef.current = false;
    });
  }, [create]);

  // The empty-state or drawer button unmounts when a notebook is created, so
  // focus is moved to the new active heading after the list commits.
  useEffect(() => {
    if (!focusAfterCreateRef.current || activeId === null) {
      return;
    }

    focusAfterCreateRef.current = false;
    activeHeadingRef.current?.focus();
  }, [activeId]);

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
      {notebooks.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : active ? (
        <section className="mx-auto flex w-full max-w-[72ch] flex-col gap-1 p-6">
          <h2
            ref={activeHeadingRef}
            tabIndex={-1}
            className="text-lg font-semibold text-on-surface"
          >
            {active.title}
          </h2>
          <p className="text-sm text-on-surface-variant">
            {lineLabel}. Card editing is not available yet.
          </p>
        </section>
      ) : (
        <section className="mx-auto flex w-full max-w-[72ch] flex-col gap-1 p-6">
          <p className="text-sm text-on-surface-variant">Select a notebook to continue.</p>
        </section>
      )}
    </AppShell>
  );
}
