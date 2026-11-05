import { useCallback, useEffect, useRef, useState } from "react";

import type { Line, Notebook } from "../../data/models.ts";
import {
  createNotebook,
  deleteNotebook,
  listNotebooks,
  reorderNotebooks,
  replaceAllNotebooks,
  updateNotebook,
} from "../../data/notebooks.ts";

export type NotebookSection = "pinned" | "unpinned";

export type UseNotebooks = {
  notebooks: Notebook[];
  activeId: string | null;
  /** Bumped whenever the whole table is replaced so open editors reload. */
  revision: number;
  select: (id: string | null) => void;
  create: (title?: string, lines?: Line[]) => Promise<Notebook>;
  rename: (id: string, title: string) => Promise<void>;
  setPinned: (id: string, pinned: boolean) => Promise<void>;
  setIgnoreCase: (id: string, ignoreCase: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (section: NotebookSection, orderedIds: string[]) => Promise<void>;
  replaceAll: (notebooks: Notebook[]) => Promise<void>;
};

export function useNotebooks(): UseNotebooks {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  // Guards against an earlier list request overwriting a newer mutation's list.
  const requestRef = useRef(0);
  const notebooksRef = useRef<Notebook[]>([]);

  const applyNotebooks = useCallback((next: Notebook[]) => {
    notebooksRef.current = next;
    setNotebooks(next);
  }, []);

  const refresh = useCallback(async (): Promise<Notebook[]> => {
    const request = ++requestRef.current;
    const next = await listNotebooks();

    if (request === requestRef.current) {
      applyNotebooks(next);
    }

    return next;
  }, [applyNotebooks]);

  useEffect(() => {
    let mounted = true;
    const request = ++requestRef.current;

    listNotebooks().then(
      (next) => {
        if (!mounted || request !== requestRef.current) {
          return;
        }

        applyNotebooks(next);
        setActiveId((current) => current ?? next[0]?.id ?? null);
      },
      () => {
        // IndexedDB is unavailable; first run stays empty.
      },
    );

    return () => {
      mounted = false;
    };
  }, [applyNotebooks]);

  const select = useCallback((id: string | null) => {
    setActiveId(id);
  }, []);

  const create = useCallback(
    async (title?: string, lines?: Line[]): Promise<Notebook> => {
      const notebook = await createNotebook(title, lines);

      await refresh();
      setActiveId(notebook.id);

      return notebook;
    },
    [refresh],
  );

  const rename = useCallback(
    async (id: string, title: string): Promise<void> => {
      await updateNotebook(id, { title });
      await refresh();
    },
    [refresh],
  );

  const setPinned = useCallback(
    async (id: string, pinned: boolean): Promise<void> => {
      await updateNotebook(id, { pinned });

      const current = await listNotebooks();
      const moved = current.find((notebook) => notebook.id === id);

      // Move the notebook to the top of its new section, then persist the
      // whole section order; the repository rejects partial lists.
      if (moved && moved.pinned === pinned) {
        const section: NotebookSection = pinned ? "pinned" : "unpinned";
        const orderedIds = [
          id,
          ...current
            .filter((notebook) => notebook.pinned === pinned && notebook.id !== id)
            .map((notebook) => notebook.id),
        ];

        await reorderNotebooks(section, orderedIds);
      }

      await refresh();
    },
    [refresh],
  );

  const setIgnoreCase = useCallback(
    async (id: string, ignoreCase: boolean): Promise<void> => {
      await updateNotebook(id, { ignoreCase });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const previous = notebooksRef.current;

      await deleteNotebook(id);
      const next = await refresh();

      setActiveId((current) => {
        if (current !== id) {
          return current;
        }

        if (next.length === 0) {
          return null;
        }

        // Select the item that followed the deleted one, or the new last item.
        const index = previous.findIndex((notebook) => notebook.id === id);
        const candidate = next[index] ?? next[index - 1] ?? next[0];

        return candidate?.id ?? null;
      });
    },
    [refresh],
  );

  const reorder = useCallback(
    async (section: NotebookSection, orderedIds: string[]): Promise<void> => {
      await reorderNotebooks(section, orderedIds);
      await refresh();
    },
    [refresh],
  );

  const replaceAll = useCallback(
    async (next: Notebook[]): Promise<void> => {
      await replaceAllNotebooks(next);
      const refreshed = await refresh();

      setActiveId((current) => {
        if (current && refreshed.some((notebook) => notebook.id === current)) {
          return current;
        }

        return refreshed[0]?.id ?? null;
      });
      setRevision((current) => current + 1);
    },
    [refresh],
  );

  return {
    notebooks,
    activeId,
    revision,
    select,
    create,
    rename,
    setPinned,
    setIgnoreCase,
    remove,
    reorder,
    replaceAll,
  };
}
