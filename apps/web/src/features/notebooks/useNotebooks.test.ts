import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";

import { db } from "../../data/db.ts";
import { createNotebook, listNotebooks } from "../../data/notebooks.ts";
import { useNotebooks } from "./useNotebooks.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

test("first run stays empty and never creates a notebook", async () => {
  const { result } = renderHook(() => useNotebooks());

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  expect(result.current.notebooks).toEqual([]);
  expect(result.current.activeId).toBeNull();
  await expect(listNotebooks()).resolves.toEqual([]);
});

test("selects the first notebook after the initial load", async () => {
  await createNotebook("First");
  const second = await createNotebook("Second");

  const { result } = renderHook(() => useNotebooks());

  await waitFor(() => {
    expect(result.current.notebooks).toHaveLength(2);
  });
  expect(result.current.activeId).toBe(second.id);
});

test("creates a notebook, selects it and puts it on top of the unpinned list", async () => {
  const existing = await createNotebook("Existing");
  const { result } = renderHook(() => useNotebooks());

  await waitFor(() => {
    expect(result.current.notebooks).toHaveLength(1);
  });

  let createdId = "";
  await act(async () => {
    const created = await result.current.create();
    createdId = created.id;
  });

  expect(result.current.activeId).toBe(createdId);
  expect(result.current.notebooks.map((notebook) => notebook.id)).toEqual([createdId, existing.id]);
  await expect(listNotebooks()).resolves.toMatchObject([{ id: createdId }, { id: existing.id }]);
});

test("creates a notebook with title and lines, selects it and puts it on top", async () => {
  const existing = await createNotebook("Existing");
  const lines = [
    { id: crypto.randomUUID(), text: "alpha" },
    { id: crypto.randomUUID(), text: "beta" },
  ];
  const { result } = renderHook(() => useNotebooks());

  await waitFor(() => {
    expect(result.current.notebooks).toHaveLength(1);
  });

  let createdId = "";
  await act(async () => {
    const created = await result.current.create("Imported", lines);
    createdId = created.id;
  });

  expect(result.current.activeId).toBe(createdId);
  expect(result.current.notebooks[0]).toMatchObject({
    id: createdId,
    title: "Imported",
    lines,
  });
  expect(result.current.notebooks.map((notebook) => notebook.id)).toEqual([createdId, existing.id]);
  await expect(listNotebooks()).resolves.toMatchObject([
    { id: createdId, title: "Imported", lines },
    { id: existing.id },
  ]);
});

test("renames through the repository, normalizing blank titles", async () => {
  const notebook = await createNotebook("Before");
  const { result } = renderHook(() => useNotebooks());

  await waitFor(() => {
    expect(result.current.notebooks).toHaveLength(1);
  });

  await act(async () => {
    await result.current.rename(notebook.id, "  After  ");
  });
  expect(result.current.notebooks[0]?.title).toBe("After");

  await act(async () => {
    await result.current.rename(notebook.id, "   ");
  });
  expect(result.current.notebooks[0]?.title).toBe("Untitled");
});

test("pinning moves a notebook to the top of its new section", async () => {
  const first = await createNotebook("First");
  const second = await createNotebook("Second");
  const third = await createNotebook("Third");
  const { result } = renderHook(() => useNotebooks());

  await waitFor(() => {
    expect(result.current.notebooks).toHaveLength(3);
  });

  await act(async () => {
    await result.current.setPinned(second.id, true);
  });

  expect(result.current.notebooks[0]?.id).toBe(second.id);
  expect(result.current.notebooks.map((notebook) => notebook.id)).toEqual([
    second.id,
    third.id,
    first.id,
  ]);

  const persisted = await listNotebooks();
  expect(persisted.filter((notebook) => notebook.pinned).map((notebook) => notebook.id)).toEqual([
    second.id,
  ]);
  expect(persisted.filter((notebook) => !notebook.pinned).map((notebook) => notebook.id)).toEqual([
    third.id,
    first.id,
  ]);

  await act(async () => {
    await result.current.setPinned(first.id, true);
  });
  expect(
    result.current.notebooks.filter((notebook) => notebook.pinned).map((notebook) => notebook.id),
  ).toEqual([first.id, second.id]);

  await act(async () => {
    await result.current.setPinned(first.id, false);
  });
  expect(
    result.current.notebooks.filter((notebook) => !notebook.pinned).map((notebook) => notebook.id),
  ).toEqual([first.id, third.id]);
  await expect(listNotebooks()).resolves.toMatchObject([
    { id: second.id, pinned: true },
    { id: first.id, pinned: false },
    { id: third.id, pinned: false },
  ]);
});

test("removing the active notebook selects the next item or clears the id", async () => {
  const first = await createNotebook("First");
  const second = await createNotebook("Second");
  const third = await createNotebook("Third");
  const { result } = renderHook(() => useNotebooks());

  await waitFor(() => {
    expect(result.current.notebooks).toHaveLength(3);
  });

  // List order is third, second, first.
  act(() => {
    result.current.select(second.id);
  });
  await act(async () => {
    await result.current.remove(second.id);
  });
  expect(result.current.activeId).toBe(first.id);

  await act(async () => {
    await result.current.remove(first.id);
  });
  expect(result.current.activeId).toBe(third.id);

  await act(async () => {
    await result.current.remove(third.id);
  });
  expect(result.current.activeId).toBeNull();
  expect(result.current.notebooks).toEqual([]);
});

test("removing a different notebook keeps the active id", async () => {
  const first = await createNotebook("First");
  const second = await createNotebook("Second");
  const { result } = renderHook(() => useNotebooks());

  await waitFor(() => {
    expect(result.current.notebooks).toHaveLength(2);
  });

  act(() => {
    result.current.select(first.id);
  });
  await act(async () => {
    await result.current.remove(second.id);
  });

  expect(result.current.activeId).toBe(first.id);
});

test("reorder persists a section order and refreshes the list", async () => {
  const first = await createNotebook("First");
  const second = await createNotebook("Second");
  const { result } = renderHook(() => useNotebooks());

  await waitFor(() => {
    expect(result.current.notebooks.map((notebook) => notebook.id)).toEqual([second.id, first.id]);
  });

  await act(async () => {
    await result.current.reorder("unpinned", [first.id, second.id]);
  });

  expect(result.current.notebooks.map((notebook) => notebook.id)).toEqual([first.id, second.id]);
  await expect(listNotebooks()).resolves.toMatchObject([{ id: first.id }, { id: second.id }]);
});
