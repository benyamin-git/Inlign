import { expect, test } from "vitest";

import type { Notebook } from "../../data/models.ts";
import { moveSectionIds, sectionItems } from "./notebookSection.ts";

function notebook(id: string, pinned: boolean): Notebook {
  return {
    id,
    title: id,
    lines: [{ id: `${id}-line`, text: "" }],
    pinned,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}

const pinned = notebook("pinned-a", true);
const first = notebook("first", false);
const second = notebook("second", false);
const third = notebook("third", false);
const notebooks = [pinned, first, second, third];

test("finds the section ids in list order", () => {
  expect(sectionItems(notebooks, first.id)).toEqual({
    section: "unpinned",
    ids: [first.id, second.id, third.id],
  });
  expect(sectionItems(notebooks, pinned.id)).toEqual({
    section: "pinned",
    ids: [pinned.id],
  });
  expect(sectionItems(notebooks, "missing")).toBeNull();
});

test("computes the complete id order for a same-section move", () => {
  expect(moveSectionIds([first.id, second.id, third.id], first.id, third.id)).toEqual([
    second.id,
    third.id,
    first.id,
  ]);
  expect(moveSectionIds([first.id, second.id, third.id], third.id, first.id)).toEqual([
    third.id,
    first.id,
    second.id,
  ]);
});

test("rejects a self drop, a missing id, a null over and a cross-section over", () => {
  const ids = [first.id, second.id, third.id];

  expect(moveSectionIds(ids, first.id, first.id)).toBeNull();
  expect(moveSectionIds(ids, first.id, null)).toBeNull();
  expect(moveSectionIds(ids, first.id, "missing")).toBeNull();
  expect(moveSectionIds(ids, "missing", first.id)).toBeNull();
  // A pinned id is not part of the unpinned section, so the drop is ignored.
  expect(moveSectionIds(ids, first.id, pinned.id)).toBeNull();
});
