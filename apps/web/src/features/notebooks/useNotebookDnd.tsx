import {
  closestCenter,
  DndContext,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";

import type { Notebook } from "../../data/models.ts";
import { moveSectionIds, sectionItems, type NotebookSectionItems } from "./notebookSection.ts";
import type { NotebookSection } from "./useNotebooks.ts";

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "To move a notebook within its section, focus its title and press Space. Use the arrow keys to move it, Space to drop it, and Escape to cancel. Notebooks cannot move between the pinned and unpinned sections.",
};

export type NotebookDndProviderProps = {
  notebooks: Notebook[];
  onReorder: (section: NotebookSection, orderedIds: string[]) => Promise<void>;
  children: ReactNode;
};

/**
 * Sidebar drag context. Sensors mirror the card list: a pointer drag needs a
 * little movement, a touch drag needs a hold, and the keyboard starts and ends
 * a drag with Space only so Enter still activates the notebook title.
 */
export function NotebookDndProvider({ notebooks, onReorder, children }: NotebookDndProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: [KeyboardCode.Space],
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Space, KeyboardCode.Tab],
      },
    }),
  );
  // Set on a valid drop; focus moves once the reordered list commits.
  const pendingFocusId = useRef<string | null>(null);

  const announcements = useMemo<Announcements>(() => {
    const titleOf = (id: string) =>
      notebooks.find((notebook) => notebook.id === id)?.title ?? "Notebook";
    const itemsOf = (id: string) => sectionItems(notebooks, id);
    const position = (items: NotebookSectionItems, id: string) => String(items.ids.indexOf(id) + 1);
    const total = (items: NotebookSectionItems) => String(items.ids.length);

    return {
      onDragStart({ active }) {
        const activeId = String(active.id);
        const items = itemsOf(activeId);

        return items === null || !items.ids.includes(activeId)
          ? undefined
          : `Picked up ${titleOf(activeId)}. Position ${position(items, activeId)} of ${total(items)}.`;
      },
      onDragOver({ active, over }) {
        const activeId = String(active.id);
        const overId = over ? String(over.id) : null;
        const items = itemsOf(activeId);

        if (items === null || overId === null || !items.ids.includes(overId)) {
          return `Cannot move ${titleOf(activeId)} to another section.`;
        }

        return `${titleOf(activeId)} is over position ${position(items, overId)} of ${total(items)}.`;
      },
      onDragEnd({ active, over }) {
        const activeId = String(active.id);
        const overId = over ? String(over.id) : null;
        const items = itemsOf(activeId);

        if (items === null || overId === null || !items.ids.includes(overId)) {
          return `${titleOf(activeId)} dropped at its current position.`;
        }

        return `${titleOf(activeId)} dropped at position ${position(items, overId)} of ${total(items)}.`;
      },
      onDragCancel({ active }) {
        const activeId = String(active.id);
        const items = itemsOf(activeId);

        return items === null
          ? `Drag cancelled.`
          : `Drag cancelled. ${titleOf(activeId)} returned to position ${position(items, activeId)}.`;
      },
    };
  }, [notebooks]);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      const activeId = String(active.id);
      const items = sectionItems(notebooks, activeId);

      if (items === null || over === null) {
        return;
      }

      // A drop over the other section is not part of this section's ids, so
      // the move is rejected before anything is persisted.
      const orderedIds = moveSectionIds(items.ids, activeId, String(over.id));

      if (orderedIds === null) {
        return;
      }

      pendingFocusId.current = activeId;

      void onReorder(items.section, orderedIds).catch(() => {
        if (pendingFocusId.current === activeId) {
          pendingFocusId.current = null;
        }
      });
    },
    [notebooks, onReorder],
  );

  const orderSignature = notebooks.map((notebook) => notebook.id).join("|");

  // dnd-kit restores focus to the activator itself, but the reordered list is
  // written asynchronously. Re-focusing the title after the new order commits
  // keeps focus on the moved item for pointer and keyboard drops alike.
  useLayoutEffect(() => {
    const id = pendingFocusId.current;

    if (id === null) {
      return;
    }

    pendingFocusId.current = null;

    Array.from(document.querySelectorAll<HTMLElement>("[data-notebook-title-id]"))
      .find((element) => element.dataset.notebookTitleId === id)
      ?.focus();
  }, [orderSignature]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      onDragEnd={handleDragEnd}
    >
      {children}
    </DndContext>
  );
}

export type NotebookSortableSectionProps = {
  items: string[];
  children: ReactNode;
};

/** Gives one sidebar section its own vertical sortable context. */
export function NotebookSortableSection({ items, children }: NotebookSortableSectionProps) {
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}
