import { useCallback, useEffect, useRef } from "react";

import type { Notebook } from "../../data/models.ts";
import type { NotebookSection } from "./useNotebooks.ts";
import { IconButton } from "../../ui/IconButton.tsx";
import { CloseIcon, PlusIcon } from "../../ui/icons.tsx";
import { NotebookItem } from "./NotebookItem.tsx";
import { NotebookDndProvider, NotebookSortableSection } from "./useNotebookDnd.tsx";

export type NotebookSidebarProps = {
  notebooks: Notebook[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => Promise<unknown>;
  onRename: (id: string, title: string) => Promise<void>;
  onSetPinned: (id: string, pinned: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (section: NotebookSection, orderedIds: string[]) => Promise<void>;
  onExport?: ((notebook: Notebook) => void) | undefined;
  onNavigate?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
};

type PendingFocus = { kind: "pin"; id: string } | { kind: "delete" };

export function NotebookSidebar({
  notebooks,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onSetPinned,
  onDelete,
  onReorder,
  onExport,
  onNavigate,
  onClose,
}: NotebookSidebarProps) {
  const pinned = notebooks.filter((notebook) => notebook.pinned);
  const unpinned = notebooks.filter((notebook) => !notebook.pinned);
  const rootRef = useRef<HTMLDivElement>(null);
  const newNotebookRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<PendingFocus | null>(null);

  const focusTitle = useCallback((id: string | null): boolean => {
    if (!id) {
      return false;
    }

    const target = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>("[data-notebook-title-id]") ?? [],
    ).find((element) => element.dataset.notebookTitleId === id);

    target?.focus();

    return target !== undefined;
  }, []);

  // Mutations can move or remove the focused item, so focus is restored from
  // the sidebar's own subtree once the new list has committed.
  useEffect(() => {
    const pending = pendingFocusRef.current;

    if (!pending) {
      return;
    }

    pendingFocusRef.current = null;

    if (pending.kind === "pin") {
      focusTitle(pending.id);
      return;
    }

    if (!focusTitle(activeId)) {
      newNotebookRef.current?.focus();
    }
  }, [notebooks, activeId, focusTitle]);

  async function handleSetPinned(id: string, pinnedState: boolean): Promise<void> {
    pendingFocusRef.current = { kind: "pin", id };

    try {
      await onSetPinned(id, pinnedState);
    } catch {
      pendingFocusRef.current = null;
    }
  }

  async function handleDelete(id: string): Promise<void> {
    pendingFocusRef.current = { kind: "delete" };

    try {
      await onDelete(id);
    } catch {
      pendingFocusRef.current = null;
    }
  }

  function handleCreate(): void {
    void Promise.resolve(onCreate()).then(() => {
      onNavigate?.();
    });
  }

  function handleSelect(id: string): void {
    onSelect(id);
    onNavigate?.();
  }

  function renderSection(section: NotebookSection, title: string | null, items: Notebook[]) {
    if (items.length === 0) {
      return null;
    }

    return (
      <section className="flex flex-col gap-1">
        {title ? (
          <h3 className="px-2 pt-3 pb-1 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
            {title}
          </h3>
        ) : null}
        <NotebookSortableSection items={items.map((notebook) => notebook.id)}>
          <ul data-notebook-section={section} className="flex flex-col gap-0.5">
            {items.map((notebook) => (
              <NotebookItem
                key={notebook.id}
                notebook={notebook}
                active={notebook.id === activeId}
                onSelect={() => {
                  handleSelect(notebook.id);
                }}
                onRename={(nextTitle) => onRename(notebook.id, nextTitle)}
                onSetPinned={(nextPinned) => handleSetPinned(notebook.id, nextPinned)}
                onDelete={() => handleDelete(notebook.id)}
                onExport={
                  onExport
                    ? () => {
                        onExport(notebook);
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        </NotebookSortableSection>
      </section>
    );
  }

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-12 items-center justify-between gap-2 px-3">
        <h2 className="text-sm font-semibold text-on-surface">Notebooks</h2>
        <div className="flex items-center gap-1">
          <IconButton ref={newNotebookRef} label="New notebook" onClick={handleCreate}>
            <PlusIcon />
          </IconButton>
          {onClose ? (
            <IconButton label="Close sidebar" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          ) : null}
        </div>
      </div>
      <nav aria-label="Notebooks" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {notebooks.length === 0 ? (
          <p className="px-2 py-3 text-sm text-on-surface-variant">No notebooks yet.</p>
        ) : (
          <NotebookDndProvider notebooks={notebooks} onReorder={onReorder} focusRootRef={rootRef}>
            {renderSection("pinned", "Pinned", pinned)}
            {renderSection("unpinned", pinned.length > 0 ? "Unpinned" : null, unpinned)}
          </NotebookDndProvider>
        )}
      </nav>
    </div>
  );
}
