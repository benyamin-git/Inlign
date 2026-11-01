import type { Notebook } from "../../data/models.ts";
import type { NotebookSection } from "./useNotebooks.ts";
import { IconButton } from "../../ui/IconButton.tsx";
import { CloseIcon, PlusIcon } from "../../ui/icons.tsx";
import { NotebookItem } from "./NotebookItem.tsx";

export type NotebookSidebarProps = {
  notebooks: Notebook[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => Promise<unknown>;
  onRename: (id: string, title: string) => Promise<void>;
  onSetPinned: (id: string, pinned: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Reserved for the section drag milestone. */
  onReorder: (section: NotebookSection, orderedIds: string[]) => Promise<void>;
  onNavigate?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
};

export function NotebookSidebar({
  notebooks,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onSetPinned,
  onDelete,
  onNavigate,
  onClose,
}: NotebookSidebarProps) {
  const pinned = notebooks.filter((notebook) => notebook.pinned);
  const unpinned = notebooks.filter((notebook) => !notebook.pinned);

  function handleCreate(): void {
    void Promise.resolve(onCreate()).then(() => {
      onNavigate?.();
    });
  }

  function handleSelect(id: string): void {
    onSelect(id);
    onNavigate?.();
  }

  function renderSection(title: string | null, items: Notebook[]) {
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
        <ul className="flex flex-col gap-0.5">
          {items.map((notebook) => (
            <NotebookItem
              key={notebook.id}
              notebook={notebook}
              active={notebook.id === activeId}
              onSelect={() => {
                handleSelect(notebook.id);
              }}
              onRename={(nextTitle) => onRename(notebook.id, nextTitle)}
              onSetPinned={(nextPinned) => onSetPinned(notebook.id, nextPinned)}
              onDelete={() => onDelete(notebook.id)}
            />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-12 items-center justify-between gap-2 px-3">
        <h2 className="text-sm font-semibold text-on-surface">Notebooks</h2>
        <div className="flex items-center gap-1">
          <IconButton label="New notebook" onClick={handleCreate}>
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
          <>
            {renderSection("Pinned", pinned)}
            {renderSection(pinned.length > 0 ? "Unpinned" : null, unpinned)}
          </>
        )}
      </nav>
    </div>
  );
}
