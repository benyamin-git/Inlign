import { useEffect, useRef, useState } from "react";

import type { Backup } from "../../data/backup.ts";
import { Button } from "../../ui/Button.tsx";
import { Dialog } from "../../ui/Dialog.tsx";
import type { ImportMode } from "./useTransfer.ts";

export type ImportDialogProps = {
  open: boolean;
  backup: Backup | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onExportBackup: () => boolean;
  onApply: (mode: ImportMode) => Promise<void>;
};

export function ImportDialog({
  open,
  backup,
  busy,
  error,
  onCancel,
  onExportBackup,
  onApply,
}: ImportDialogProps) {
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);

  // A new file or a closed dialog starts from the mode list because the app
  // remounts this dialog with a key derived from the pending backup.
  useEffect(() => {
    if (confirmingReplace) {
      confirmRef.current?.focus();
    }
  }, [confirmingReplace]);

  if (!open || !backup) {
    return null;
  }

  const notebookCount = backup.notebooks.length;
  const lineCount = backup.notebooks.reduce((sum, notebook) => sum + notebook.lines.length, 0);
  const notebookLabel = notebookCount === 1 ? "notebook" : "notebooks";
  const lineLabel = lineCount === 1 ? "line" : "lines";

  function startReplace(): void {
    // The safety download must succeed before the confirmation is offered.
    if (!onExportBackup()) {
      return;
    }

    setConfirmingReplace(true);
  }

  function cancelReplace(): void {
    setConfirmingReplace(false);
    replaceRef.current?.focus();
  }

  return (
    <Dialog
      open
      title={confirmingReplace ? "Replace all data?" : "Import backup"}
      onClose={busy ? () => {} : onCancel}
      actions={
        confirmingReplace ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="text" disabled={busy} onClick={cancelReplace}>
              Keep current data
            </Button>
            <Button
              ref={confirmRef}
              variant="destructive"
              disabled={busy}
              onClick={() => {
                void onApply("replace");
              }}
            >
              Replace all data
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="text" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="tonal"
              disabled={busy}
              onClick={() => {
                void onApply("add");
              }}
            >
              Add as new
            </Button>
            <Button
              variant="tonal"
              disabled={busy}
              onClick={() => {
                void onApply("merge");
              }}
            >
              Merge
            </Button>
            <Button ref={replaceRef} variant="destructive" disabled={busy} onClick={startReplace}>
              Replace all
            </Button>
          </div>
        )
      }
    >
      {confirmingReplace ? (
        <div className="flex flex-col gap-3">
          <p>
            This removes every current notebook and restores the {notebookCount} {notebookLabel}{" "}
            from the backup, plus its theme and accent.
          </p>
          <p>A safety backup of your current data was downloaded first.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p>
            This backup contains {notebookCount} {notebookLabel} and {lineCount} {lineLabel}.
          </p>
          <dl className="flex flex-col gap-2">
            <div>
              <dt className="font-semibold text-on-surface">Add as new</dt>
              <dd>Creates copies with new ids and keeps every current notebook.</dd>
            </div>
            <div>
              <dt className="font-semibold text-on-surface">Merge</dt>
              <dd>Updates matching notebooks, adds missing ones and keeps the rest.</dd>
            </div>
            <div>
              <dt className="font-semibold text-on-surface">Replace all</dt>
              <dd>
                Removes current notebooks and restores the backup&apos;s notebooks, theme and
                accent. Download a safety backup before confirming.
              </dd>
            </div>
          </dl>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-loss">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
