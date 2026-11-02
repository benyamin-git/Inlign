import { useEffect, useMemo } from "react";

import type { Line } from "../../data/models.ts";
import { updateNotebook } from "../../data/notebooks.ts";
import { debounce, type Debounced } from "../../lib/debounce.ts";

export const AUTOSAVE_DELAY_MS = 400;

export type UseAutosave = {
  schedule: (lines: Line[]) => void;
  flush: () => void;
  cancel: () => void;
};

function createSaver(notebookId: string): Debounced<[Line[]]> {
  return debounce((lines) => {
    // A failed write must stay contained; retry and error UI come later.
    void updateNotebook(notebookId, { lines, updatedAt: Date.now() }).catch(() => {
      // The next text edit schedules another attempt.
    });
  }, AUTOSAVE_DELAY_MS);
}

/**
 * Debounced text persistence for one notebook. Structure changes write through
 * the editor directly and call `cancel()` first, so a delayed text snapshot can
 * never overwrite a newer structure.
 */
export function useAutosave(notebookId: string): UseAutosave {
  const save = useMemo(() => createSaver(notebookId), [notebookId]);

  useEffect(() => {
    const flush = (): void => {
      save.flush();
    };
    const flushWhenHidden = (): void => {
      if (document.visibilityState === "hidden") {
        save.flush();
      }
    };

    window.addEventListener("blur", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flushWhenHidden);

    return () => {
      window.removeEventListener("blur", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flushWhenHidden);
      // The editor is keyed by notebook id, so unmounting is how a switch
      // happens. Pending text must reach storage before the next notebook
      // mounts and reads it.
      save.flush();
      save.cancel();
    };
  }, [save]);

  return { schedule: save, flush: save.flush, cancel: save.cancel };
}
