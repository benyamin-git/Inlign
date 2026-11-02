import { afterAll, beforeEach, expect, test, vi } from "vitest";

import { db } from "./db.ts";
import {
  createNotebook,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  reorderNotebooks,
  replaceAllNotebooks,
  updateNotebook,
} from "./notebooks.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterAll(() => {
  db.close();
});

test("creates a notebook with a UUID, one empty line and obtained timestamps", async () => {
  const notebook = await createNotebook();

  expect(notebook.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(notebook.title).toBe("Untitled");
  expect(notebook.lines).toHaveLength(1);
  expect(notebook.lines[0]?.text).toBe("");
  expect(notebook.lines[0]?.id).not.toBe(notebook.id);
  expect(notebook.pinned).toBe(false);
  expect(notebook.createdAt).toBe(notebook.updatedAt);

  await expect(getNotebook(notebook.id)).resolves.toEqual(notebook);
});

test.each([
  [undefined, "Untitled"],
  ["  ", "Untitled"],
  ["  Draft  ", "Draft"],
  ["x".repeat(130), "x".repeat(120)],
] as const)("normalizes the title %j to %j", async (input, expected) => {
  const notebook = await createNotebook(input);

  expect(notebook.title).toBe(expected);
});

test("creates a notebook at the top of the unpinned section", async () => {
  const first = await createNotebook("First");
  const second = await createNotebook("Second");

  expect(second.sortOrder).toBeLessThan(first.sortOrder);

  const notebooks = await listNotebooks();

  expect(notebooks.map((notebook) => notebook.id)).toEqual([second.id, first.id]);
});

test("creates a notebook with the provided lines in one write", async () => {
  const existing = await createNotebook("Existing");
  const lines = [
    { id: crypto.randomUUID(), text: "first" },
    { id: crypto.randomUUID(), text: "" },
    { id: crypto.randomUUID(), text: "third" },
  ];
  const notebook = await createNotebook("  Imported  ", lines);

  expect(notebook.title).toBe("Imported");
  expect(notebook.lines).toEqual(lines);
  expect(notebook.lines).not.toBe(lines);
  expect(notebook.createdAt).toBe(notebook.updatedAt);
  expect(notebook.sortOrder).toBeLessThan(existing.sortOrder);

  await expect(getNotebook(notebook.id)).resolves.toEqual(notebook);
});

test("rejects an empty lines array when creating and writes nothing", async () => {
  await expect(createNotebook("Empty", [])).rejects.toThrow(
    "A notebook must have at least one line",
  );

  await expect(listNotebooks()).resolves.toEqual([]);
});

test("lists pinned notebooks first, then by sortOrder, updatedAt and id", async () => {
  const a = await createNotebook("a");
  const b = await createNotebook("b");
  const c = await createNotebook("c");
  const d = await createNotebook("d");

  await updateNotebook(a.id, { sortOrder: 1, updatedAt: 100 });
  await updateNotebook(b.id, { sortOrder: 0, updatedAt: 100 });
  await updateNotebook(c.id, { pinned: true, sortOrder: 5, updatedAt: 0 });
  await updateNotebook(d.id, { sortOrder: 0, updatedAt: 200 });

  const notebooks = await listNotebooks();

  expect(notebooks.map((notebook) => notebook.id)).toEqual([c.id, d.id, b.id, a.id]);
});

test("breaks a full ordering tie by ascending id", async () => {
  const first = await createNotebook("first");
  const second = await createNotebook("second");

  await updateNotebook(first.id, { sortOrder: 7, updatedAt: 42 });
  await updateNotebook(second.id, { sortOrder: 7, updatedAt: 42 });

  const notebooks = await listNotebooks();

  expect(notebooks.map((notebook) => notebook.id)).toEqual([first.id, second.id].sort());
});

test("returns undefined for an unknown notebook", async () => {
  await expect(getNotebook("missing")).resolves.toBeUndefined();
});

test("normalizes title updates", async () => {
  const notebook = await createNotebook("Keep me");

  await expect(updateNotebook(notebook.id, { title: "  " })).resolves.toMatchObject({
    title: "Untitled",
  });
  await expect(updateNotebook(notebook.id, { title: "  Renamed  " })).resolves.toMatchObject({
    title: "Renamed",
  });
  await expect(updateNotebook(notebook.id, { title: "y".repeat(130) })).resolves.toMatchObject({
    title: "y".repeat(120),
  });
});

test("replaces lines", async () => {
  const notebook = await createNotebook("Lines");
  const lines = [
    { id: crypto.randomUUID(), text: "first" },
    { id: crypto.randomUUID(), text: "second" },
  ];

  const updated = await updateNotebook(notebook.id, { lines });

  expect(updated.lines).toEqual(lines);
});

test("bumps updatedAt on title and line edits", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1_000);

  try {
    const notebook = await createNotebook("Note");

    now.mockReturnValue(2_000);
    await expect(updateNotebook(notebook.id, { title: "Renamed" })).resolves.toMatchObject({
      updatedAt: 2_000,
    });

    now.mockReturnValue(3_000);
    await expect(
      updateNotebook(notebook.id, { lines: [{ id: crypto.randomUUID(), text: "x" }] }),
    ).resolves.toMatchObject({ updatedAt: 3_000 });
  } finally {
    now.mockRestore();
  }
});

test("preserves updatedAt for pin and order changes", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1_000);

  try {
    const notebook = await createNotebook("Note");

    now.mockReturnValue(9_000);

    const pinned = await updateNotebook(notebook.id, { pinned: true });
    expect(pinned.updatedAt).toBe(1_000);
    expect(pinned.pinned).toBe(true);

    const reordered = await updateNotebook(notebook.id, { sortOrder: 12 });
    expect(reordered.updatedAt).toBe(1_000);
    expect(reordered.sortOrder).toBe(12);
  } finally {
    now.mockRestore();
  }
});

test("honors an explicit updatedAt in the patch", async () => {
  const notebook = await createNotebook("Note");

  const updated = await updateNotebook(notebook.id, { title: "Renamed", updatedAt: 42 });

  expect(updated.updatedAt).toBe(42);
});

test("rejects an empty lines array and leaves the notebook unchanged", async () => {
  const notebook = await createNotebook("Note");

  await expect(updateNotebook(notebook.id, { lines: [] })).rejects.toThrow(
    "A notebook must have at least one line",
  );

  await expect(getNotebook(notebook.id)).resolves.toEqual(notebook);
});

test("rejects an update for an unknown notebook", async () => {
  await expect(updateNotebook("missing", { title: "Nope" })).rejects.toThrow(
    "Notebook missing not found",
  );
});

test("deletes a notebook", async () => {
  const keep = await createNotebook("Keep");
  const remove = await createNotebook("Remove");

  await deleteNotebook(remove.id);

  await expect(getNotebook(remove.id)).resolves.toBeUndefined();
  await expect(listNotebooks()).resolves.toEqual([keep]);
});

test("reorders a section without changing updatedAt", async () => {
  const first = await createNotebook("First");
  const second = await createNotebook("Second");
  const pinned = await createNotebook("Pinned");
  await updateNotebook(pinned.id, { pinned: true, sortOrder: 0 });

  const before = await listNotebooks();

  await reorderNotebooks("unpinned", [first.id, second.id]);

  const after = await listNotebooks();
  const unpinned = after.filter((notebook) => !notebook.pinned);

  expect(unpinned.map((notebook) => notebook.id)).toEqual([first.id, second.id]);
  expect(unpinned.map((notebook) => notebook.sortOrder)).toEqual([0, 1]);

  const updatedAtById = new Map(before.map((notebook) => [notebook.id, notebook.updatedAt]));

  for (const notebook of after) {
    expect(notebook.updatedAt).toBe(updatedAtById.get(notebook.id));
  }
});

test("reorders the pinned section", async () => {
  const first = await createNotebook("First");
  const second = await createNotebook("Second");
  const third = await createNotebook("Third");

  await updateNotebook(first.id, { pinned: true });
  await updateNotebook(second.id, { pinned: true });
  await updateNotebook(third.id, { pinned: true });

  const before = await listNotebooks();

  await reorderNotebooks("pinned", [third.id, first.id, second.id]);

  const after = await listNotebooks();
  const pinned = after.filter((notebook) => notebook.pinned);

  expect(pinned.map((notebook) => notebook.id)).toEqual([third.id, first.id, second.id]);
  expect(pinned.map((notebook) => notebook.sortOrder)).toEqual([0, 1, 2]);

  const updatedAtById = new Map(before.map((notebook) => [notebook.id, notebook.updatedAt]));

  for (const notebook of after) {
    expect(notebook.updatedAt).toBe(updatedAtById.get(notebook.id));
  }
});

test("rejects a partial or empty reorder list and leaves sort orders unchanged", async () => {
  const first = await createNotebook("First");
  await createNotebook("Second");
  await createNotebook("Third");

  const before = await listNotebooks();

  await expect(reorderNotebooks("unpinned", [first.id])).rejects.toThrow(
    "Reorder list must include every notebook in the unpinned section",
  );
  await expect(reorderNotebooks("unpinned", [])).rejects.toThrow(
    "Reorder list must include every notebook in the unpinned section",
  );

  const after = await listNotebooks();

  expect(after.map((notebook) => [notebook.id, notebook.sortOrder])).toEqual(
    before.map((notebook) => [notebook.id, notebook.sortOrder]),
  );
});

test("rejects reordering a missing notebook", async () => {
  const first = await createNotebook("First");
  const second = await createNotebook("Second");

  await expect(reorderNotebooks("unpinned", [first.id, "missing"])).rejects.toThrow(
    "Notebook missing not found",
  );

  await expect(getNotebook(first.id)).resolves.toMatchObject({ sortOrder: first.sortOrder });
  await expect(getNotebook(second.id)).resolves.toMatchObject({ sortOrder: second.sortOrder });
});

test("rejects reordering a notebook from the other section", async () => {
  const unpinned = await createNotebook("Unpinned");
  const pinned = await createNotebook("Pinned");
  await updateNotebook(pinned.id, { pinned: true });

  await expect(reorderNotebooks("unpinned", [pinned.id])).rejects.toThrow(
    `Notebook ${pinned.id} is not in the unpinned section`,
  );

  await expect(getNotebook(unpinned.id)).resolves.toMatchObject({
    sortOrder: unpinned.sortOrder,
  });
});

test("rejects duplicate ids in a reorder", async () => {
  const notebook = await createNotebook("Note");

  await expect(reorderNotebooks("unpinned", [notebook.id, notebook.id])).rejects.toThrow(
    "Reorder list contains duplicate notebook ids",
  );
});

test("replaces every notebook in one transaction with the stored pinned mapping", async () => {
  const existing = await createNotebook("Existing");
  const first = {
    id: crypto.randomUUID(),
    title: "First imported",
    lines: [
      { id: crypto.randomUUID(), text: "one" },
      { id: crypto.randomUUID(), text: "two" },
    ],
    pinned: true,
    sortOrder: 4,
    createdAt: 100,
    updatedAt: 200,
  };
  const second = {
    id: crypto.randomUUID(),
    title: "Second imported",
    lines: [{ id: crypto.randomUUID(), text: "three" }],
    pinned: false,
    sortOrder: 1,
    createdAt: 300,
    updatedAt: 400,
  };

  await replaceAllNotebooks([first, second]);

  await expect(getNotebook(existing.id)).resolves.toBeUndefined();
  await expect(listNotebooks()).resolves.toEqual([first, second]);

  // The boolean is mapped back at the repository boundary, not persisted.
  const raw = await db.notebooks.toArray();
  expect(Object.fromEntries(raw.map((record) => [record.id, record.pinned]))).toEqual({
    [first.id]: 1,
    [second.id]: 0,
  });
});

test("replaces the table with an empty list", async () => {
  await createNotebook("First");
  await createNotebook("Second");

  await replaceAllNotebooks([]);

  await expect(listNotebooks()).resolves.toEqual([]);
});

test("round-trips a replaced list through the repository", async () => {
  const notebooks = [
    {
      id: crypto.randomUUID(),
      title: "Only",
      lines: [{ id: crypto.randomUUID(), text: "kept" }],
      pinned: true,
      sortOrder: -1,
      createdAt: 1,
      updatedAt: 2,
    },
  ];

  await replaceAllNotebooks(notebooks);

  await expect(listNotebooks()).resolves.toEqual(notebooks);
});

test("rejects an invalid replacement before clearing the table", async () => {
  const existing = await createNotebook("Existing");

  await expect(
    replaceAllNotebooks([
      {
        id: crypto.randomUUID(),
        title: "Empty",
        lines: [],
        pinned: false,
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ]),
  ).rejects.toThrow("A notebook must have at least one line");

  await expect(listNotebooks()).resolves.toMatchObject([{ id: existing.id }]);
});

test("rejects duplicate ids in a replacement without writing anything", async () => {
  const existing = await createNotebook("Existing");
  const duplicate = {
    id: crypto.randomUUID(),
    title: "Duplicate",
    lines: [{ id: crypto.randomUUID(), text: "text" }],
    pinned: false,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  };

  await expect(replaceAllNotebooks([duplicate, duplicate])).rejects.toThrow(
    `Duplicate notebook id ${duplicate.id}`,
  );

  await expect(listNotebooks()).resolves.toMatchObject([{ id: existing.id }]);
});

test("rejects duplicate line ids in a replacement without writing anything", async () => {
  const existing = await createNotebook("Existing");
  const lineId = crypto.randomUUID();
  const notebook = {
    id: crypto.randomUUID(),
    title: "Duplicate lines",
    lines: [
      { id: lineId, text: "first" },
      { id: lineId, text: "second" },
    ],
    pinned: false,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  };

  await expect(replaceAllNotebooks([notebook])).rejects.toThrow(`Duplicate line id ${lineId}`);

  await expect(listNotebooks()).resolves.toMatchObject([{ id: existing.id }]);
});
