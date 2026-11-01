import { useEffect, useId, useRef, useState } from "react";

import type { Notebook } from "../../data/models.ts";
import { Button } from "../../ui/Button.tsx";
import { Dialog } from "../../ui/Dialog.tsx";
import { Field } from "../../ui/Field.tsx";
import { Menu } from "../../ui/Menu.tsx";
import type { MenuItem } from "../../ui/Menu.tsx";
import { MoreIcon, PinIcon } from "../../ui/icons.tsx";
import { cx } from "../../ui/cx.ts";

export type NotebookItemProps = {
  notebook: Notebook;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => Promise<void>;
  onSetPinned: (pinned: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  /** Wired by the export milestone; hidden until then. */
  onExport?: (() => void) | undefined;
};

export function NotebookItem({
  notebook,
  active,
  onSelect,
  onRename,
  onSetPinned,
  onDelete,
  onExport,
}: NotebookItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notebook.title);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const cancelledRef = useRef(false);
  const settledRef = useRef(true);
  const restoreFocusRef = useRef(false);
  const pinnedDescriptionId = useId();

  useEffect(() => {
    if (editing) {
      const input = inputRef.current;
      input?.focus();
      input?.select();

      return;
    }

    if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      titleRef.current?.focus();
    }
  }, [editing]);

  function startRename(): void {
    cancelledRef.current = false;
    settledRef.current = false;
    setDraft(notebook.title);
    setEditing(true);
  }

  async function commitRename(): Promise<void> {
    if (settledRef.current || cancelledRef.current) {
      return;
    }

    settledRef.current = true;
    setEditing(false);

    // The repository normalizes empty and whitespace-only titles to Untitled.
    if (draft.trim() === notebook.title) {
      return;
    }

    await onRename(draft);
  }

  function cancelRename(): void {
    cancelledRef.current = true;
    settledRef.current = true;
    restoreFocusRef.current = true;
    setDraft(notebook.title);
    setEditing(false);
  }

  async function confirmDelete(): Promise<void> {
    setDeleting(true);

    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const menuItems: MenuItem[] = [
    { id: "rename", label: "Rename", onSelect: startRename },
    {
      id: "pin",
      label: notebook.pinned ? "Unpin notebook" : "Pin notebook",
      onSelect: () => {
        void onSetPinned(!notebook.pinned);
      },
    },
    ...(onExport ? [{ id: "export", label: "Export .inlign", onSelect: onExport }] : []),
    {
      id: "delete",
      label: "Delete",
      destructive: true,
      onSelect: () => {
        setConfirming(true);
      },
    },
  ];

  return (
    <li>
      <div
        className={cx(
          "flex items-center gap-1 rounded-chip",
          active ? "bg-primary-container" : "hover:bg-surface-container",
        )}
      >
        {editing ? (
          <div className="min-w-0 flex-1 px-1 py-1">
            <Field
              ref={inputRef}
              label="Notebook title"
              hideLabel
              value={draft}
              autoComplete="off"
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  restoreFocusRef.current = true;
                  void commitRename();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelRename();
                }
              }}
              onBlur={(event) => {
                // A null relatedTarget means focus had nowhere to go (for
                // example the input was blurred programmatically); keep it in
                // the sidebar. A real click elsewhere keeps its own focus.
                if (event.relatedTarget === null) {
                  restoreFocusRef.current = true;
                }

                void commitRename();
              }}
            />
          </div>
        ) : (
          <button
            ref={titleRef}
            type="button"
            aria-label={notebook.title}
            aria-current={active ? "page" : undefined}
            aria-describedby={notebook.pinned ? pinnedDescriptionId : undefined}
            data-notebook-title-id={notebook.id}
            onClick={onSelect}
            className={cx(
              "flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-chip px-3 text-start text-sm md:min-h-10",
              active ? "text-on-primary-container" : "text-on-surface",
            )}
          >
            <span className="truncate">{notebook.title}</span>
            {notebook.pinned ? <PinIcon className="shrink-0" /> : null}
            {notebook.pinned ? (
              <span id={pinnedDescriptionId} className="sr-only">
                Pinned
              </span>
            ) : null}
          </button>
        )}
        {editing ? null : (
          <Menu
            label={`Actions for ${notebook.title}`}
            items={menuItems}
            triggerClassName={active ? "text-on-primary-container" : undefined}
          >
            <MoreIcon />
          </Menu>
        )}
      </div>
      <Dialog
        open={confirming}
        title="Delete notebook?"
        onClose={() => {
          setConfirming(false);
        }}
        actions={
          <>
            <Button
              variant="text"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                void confirmDelete();
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>
          <span className="font-medium text-on-surface">{notebook.title}</span> will be deleted.
          This cannot be undone.
        </p>
      </Dialog>
    </li>
  );
}
