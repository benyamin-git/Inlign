import {
  closestCenter,
  DndContext,
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

import type { Line } from "../../data/models.ts";

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "To move a line, focus its move handle and press Space or Enter. Use the arrow keys to move the line, Space or Enter to drop it, and Escape to cancel.",
};

export type CardDndProviderProps = {
  lines: Line[];
  onSort: (activeId: string, overId: string) => void;
  children: ReactNode;
};

/**
 * Drag context for the card list. Sensors are tuned so a pointer drag needs a
 * small movement, a touch drag needs a deliberate hold, and the keyboard sensor
 * follows the sortable layout. Only the grip handle in `LineCard` is wired to
 * the listeners, so text selection never starts a drag.
 */
export function CardDndProvider({ lines, onSort, children }: CardDndProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Set on a valid drop; the focus pass runs once the reordered lines commit.
  const pendingFocusId = useRef<string | null>(null);

  const announcements = useMemo<Announcements>(() => {
    const indexOf = (id: string) => lines.findIndex((line) => line.id === id);
    const total = lines.length;

    return {
      onDragStart({ active }) {
        const index = indexOf(String(active.id));

        return index < 0 ? undefined : `Picked up line ${String(index + 1)} of ${String(total)}.`;
      },
      onDragOver({ active, over }) {
        const index = indexOf(String(active.id));
        const target = over ? indexOf(String(over.id)) : -1;

        if (index < 0 || target < 0) {
          return undefined;
        }

        return `Line ${String(index + 1)} is over position ${String(target + 1)} of ${String(total)}.`;
      },
      onDragEnd({ active, over }) {
        const index = indexOf(String(active.id));
        const target = over ? indexOf(String(over.id)) : -1;

        if (index < 0) {
          return undefined;
        }

        if (target < 0 || target === index) {
          return `Line ${String(index + 1)} dropped at its current position.`;
        }

        return `Line ${String(index + 1)} dropped at position ${String(target + 1)} of ${String(total)}.`;
      },
      onDragCancel({ active }) {
        const index = indexOf(String(active.id));

        return index < 0
          ? undefined
          : `Drag cancelled. Line ${String(index + 1)} returned to position ${String(index + 1)}.`;
      },
    };
  }, [lines]);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) {
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);

      // A stale id (or a drop outside the list) must not write.
      if (
        !lines.some((line) => line.id === activeId) ||
        !lines.some((line) => line.id === overId)
      ) {
        return;
      }

      pendingFocusId.current = activeId;
      onSort(activeId, overId);
    },
    [lines, onSort],
  );

  // dnd-kit restores focus to the activator after a drag, but reordering can
  // remount the moved card. Focusing the moved grip explicitly guarantees a
  // real target instead of <body> or a textarea with a lost caret.
  useLayoutEffect(() => {
    const id = pendingFocusId.current;

    if (id === null) {
      return;
    }

    pendingFocusId.current = null;
    document.querySelector<HTMLElement>(`[data-line-id="${id}"] [data-line-grip]`)?.focus();
  }, [lines]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={lines.map((line) => line.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
