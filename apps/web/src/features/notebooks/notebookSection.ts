import type { Notebook } from "../../data/models.ts";
import type { NotebookSection } from "./useNotebooks.ts";

export type NotebookSectionItems = {
  section: NotebookSection;
  ids: string[];
};

/**
 * Finds the section a notebook belongs to and the ids of that section in
 * render order. Used to keep a drop inside one section; the sidebar's pinned
 * and unpinned lists are independent.
 */
export function sectionItems(
  notebooks: readonly Notebook[],
  id: string,
): NotebookSectionItems | null {
  const notebook = notebooks.find((candidate) => candidate.id === id);

  if (!notebook) {
    return null;
  }

  const section: NotebookSection = notebook.pinned ? "pinned" : "unpinned";

  return {
    section,
    ids: notebooks
      .filter((candidate) => candidate.pinned === notebook.pinned)
      .map((candidate) => candidate.id),
  };
}

/**
 * Computes the complete id order after moving `activeId` over `overId` inside
 * one section. Returns null for a self drop, a missing id, a drop outside the
 * list, or a drop over another section, so callers never write a partial or
 * cross-section list.
 */
export function moveSectionIds(
  ids: readonly string[],
  activeId: string,
  overId: string | null,
): string[] | null {
  if (overId === null || activeId === overId) {
    return null;
  }

  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);

  if (from < 0 || to < 0) {
    return null;
  }

  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, activeId);

  return next;
}
