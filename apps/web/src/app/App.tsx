import { NotebookEditor } from "../features/editor/NotebookEditor.tsx";
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
  );
}
