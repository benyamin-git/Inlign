import { db, type NotebookRecord } from "./db.ts";
import type { Line, Notebook } from "./models.ts";

const MAX_TITLE_LENGTH = 120;
const UNTITLED = "Untitled";

type NotebookPatch = Partial<
  Pick<Notebook, "title" | "lines" | "pinned" | "sortOrder" | "updatedAt">
>;

function normalizeTitle(title: string | undefined): string {
  const trimmed = (title ?? "").trim();

  if (trimmed.length === 0) {
    return UNTITLED;
  }

  return trimmed.slice(0, MAX_TITLE_LENGTH);
}

function toRecord(notebook: Notebook): NotebookRecord {
  return { ...notebook, pinned: notebook.pinned ? 1 : 0 };
}

function fromRecord(record: NotebookRecord): Notebook {
  return { ...record, pinned: record.pinned === 1 };
}

function isPinned(record: NotebookRecord): boolean {
  return record.pinned === 1;
}

export async function createNotebook(title?: string, lines?: Line[]): Promise<Notebook> {
  if (lines?.length === 0) {
    throw new Error("A notebook must have at least one line");
  }

  return db.transaction("rw", db.notebooks, async () => {
    const unpinned = await db.notebooks.where("pinned").equals(0).toArray();
    const sortOrder =
      unpinned.length === 0 ? 0 : Math.min(...unpinned.map((notebook) => notebook.sortOrder)) - 1;
    const now = Date.now();
    const notebook: Notebook = {
      id: crypto.randomUUID(),
      title: normalizeTitle(title),
      lines: lines
        ? lines.map((line) => ({ id: line.id, text: line.text }))
        : [{ id: crypto.randomUUID(), text: "" }],
      pinned: false,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };

    await db.notebooks.add(toRecord(notebook));

    return notebook;
  });
}

export async function listNotebooks(): Promise<Notebook[]> {
  const records = await db.notebooks.toArray();

  return records.map(fromRecord).sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

export async function getNotebook(id: string): Promise<Notebook | undefined> {
  const record = await db.notebooks.get(id);

  return record ? fromRecord(record) : undefined;
}

export async function updateNotebook(id: string, patch: NotebookPatch): Promise<Notebook> {
  return db.transaction("rw", db.notebooks, async () => {
    const record = await db.notebooks.get(id);

    if (!record) {
      throw new Error(`Notebook ${id} not found`);
    }

    const titleChanged = patch.title !== undefined;
    const linesChanged = patch.lines !== undefined;

    if (linesChanged && patch.lines?.length === 0) {
      throw new Error("A notebook must have at least one line");
    }

    const next: NotebookRecord = { ...record };

    if (titleChanged) {
      next.title = normalizeTitle(patch.title);
    }

    if (linesChanged && patch.lines) {
      next.lines = patch.lines.map((line) => ({ id: line.id, text: line.text }));
    }

    if (patch.pinned !== undefined) {
      next.pinned = patch.pinned ? 1 : 0;
    }

    if (patch.sortOrder !== undefined) {
      next.sortOrder = patch.sortOrder;
    }

    if (patch.updatedAt !== undefined) {
      next.updatedAt = patch.updatedAt;
    } else if (titleChanged || linesChanged) {
      next.updatedAt = Date.now();
    }

    await db.notebooks.put(next);

    return fromRecord(next);
  });
}

export async function deleteNotebook(id: string): Promise<void> {
  await db.notebooks.delete(id);
}

// Pinning or unpinning does not place a notebook in a section on its own.
// After changing `pinned`, the sidebar must call `reorderNotebooks` for the
// notebook's new section.
export async function reorderNotebooks(
  section: "pinned" | "unpinned",
  orderedIds: string[],
): Promise<void> {
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new Error("Reorder list contains duplicate notebook ids");
  }

  const expectedPinned = section === "pinned";

  await db.transaction("rw", db.notebooks, async () => {
    const sectionCount = await db.notebooks
      .where("pinned")
      .equals(expectedPinned ? 1 : 0)
      .count();

    if (orderedIds.length !== sectionCount) {
      throw new Error(`Reorder list must include every notebook in the ${section} section`);
    }

    const records = await db.notebooks.bulkGet(orderedIds);

    records.forEach((record, index) => {
      const id = orderedIds[index];

      if (!record) {
        throw new Error(`Notebook ${id} not found`);
      }

      if (isPinned(record) !== expectedPinned) {
        throw new Error(`Notebook ${id} is not in the ${section} section`);
      }
    });

    for (const [sortOrder, id] of orderedIds.entries()) {
      await db.notebooks.update(id, { sortOrder });
    }
  });
}
