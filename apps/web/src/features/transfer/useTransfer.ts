import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

import type { Notebook } from "../../data/models.ts";
import { parseInlign, serializeInlign, slugify } from "../../data/transfer.ts";
import { downloadFile } from "../../lib/download.ts";
import type { UseNotebooks } from "../notebooks/useNotebooks.ts";

export type TransferModel = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  error: string | null;
  busy: boolean;
  chooseImportFile: () => void;
  importFile: (file: File) => Promise<void>;
  exportNotebook: (notebook: Notebook) => void;
};

export function useTransfer(create: UseNotebooks["create"]): TransferModel {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chooseImportFile = useCallback(() => {
    setError(null);
    fileInputRef.current?.click();
  }, []);

  const importFile = useCallback(
    async (file: File): Promise<void> => {
      setBusy(true);
      setError(null);

      try {
        const fallbackTitle = file.name.replace(/\.[^.]+$/, "");
        const parsed = parseInlign(await file.text(), fallbackTitle);

        await create(parsed.title, parsed.lines);
      } catch {
        setError(`Could not import ${file.name}. Check that it is an .inlign text file.`);
      } finally {
        setBusy(false);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [create],
  );

  const exportNotebook = useCallback((notebook: Notebook): void => {
    setError(null);

    try {
      downloadFile(`${slugify(notebook.title)}.inlign`, serializeInlign(notebook));
    } catch {
      setError(`Could not export ${notebook.title}.`);
    }
  }, []);

  return { fileInputRef, error, busy, chooseImportFile, importFile, exportNotebook };
}
