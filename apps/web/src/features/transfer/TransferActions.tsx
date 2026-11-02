import type { Notebook } from "../../data/models.ts";
import { Button } from "../../ui/Button.tsx";
import type { TransferModel } from "./useTransfer.ts";

export type TransferActionsProps = {
  active: Notebook | null;
  onExport: (notebook: Notebook) => void;
  transfer: TransferModel;
};

export function TransferActions({ active, onExport, transfer }: TransferActionsProps) {
  const {
    error,
    busy,
    fileInputRef,
    backupInputRef,
    chooseImportFile,
    importFile,
    chooseBackupFile,
    importBackupFile,
    exportBackup,
  } = transfer;

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="tonal"
          disabled={!active}
          onClick={() => {
            if (active) {
              onExport(active);
            }
          }}
        >
          Export active
        </Button>
        <Button variant="tonal" disabled={busy} onClick={chooseImportFile}>
          Import .inlign
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="tonal" disabled={busy} onClick={exportBackup}>
          Export backup
        </Button>
        <Button variant="tonal" disabled={busy} onClick={chooseBackupFile}>
          Import backup
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".inlign,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void importFile(file);
          }
        }}
      />
      <input
        ref={backupInputRef}
        type="file"
        accept="application/json,.json,text/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void importBackupFile(file);
          }
        }}
      />
      {error ? (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      ) : null}
    </div>
  );
}
