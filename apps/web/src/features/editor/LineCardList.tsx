import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Line } from "../../data/models.ts";
import { createId } from "../../lib/id.ts";
import { LineCard } from "./LineCard.tsx";
import { moveLine, type LineAction } from "./lineOps.ts";
import { CardDndProvider } from "./useCardDnd.tsx";
import type { LineAnnotations } from "./useEngineEvaluation.ts";
import type { EditorFocus } from "./useNotebookEditor.ts";

export type LineCardListProps = {
  lines: Line[];
  focus: EditorFocus | null;
  annotations: LineAnnotations;
  onAction: (lineId: string, action: LineAction) => void;
  onReorder: (lines: Line[]) => void;
};

export function LineCardList({
  lines,
  focus,
  annotations,
  onAction,
  onReorder,
}: LineCardListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [fallback] = useState<Line>(() => ({ id: createId(), text: "" }));

  // Defensive only: the editor state always holds at least one line.
  const visibleLines = useMemo(() => (lines.length > 0 ? lines : [fallback]), [lines, fallback]);

  // Focus and caret land after the new cards commit, so split and paste can
  // address a line that did not exist during the event.
  useLayoutEffect(() => {
    if (!focus) {
      return;
    }

    const target = Array.from(
      listRef.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-line-id]") ?? [],
    ).find((textarea) => textarea.dataset.lineId === focus.lineId);

    if (!target) {
      return;
    }

    target.focus();
    const offset = Math.max(0, Math.min(focus.offset, target.value.length));

    target.setSelectionRange(offset, offset);
  }, [focus]);

  // The drag context validates the ids before calling this, so a drop always
  // produces a new order; persisting goes through the editor's immediate write
  // path, not the text debounce that arrives with autosave.
  const handleSort = useCallback(
    (activeId: string, overId: string) => {
      const nextLines = moveLine(visibleLines, activeId, overId);

      if (nextLines.some((line, index) => line.id !== visibleLines[index]?.id)) {
        onReorder(nextLines);
      }
    },
    [visibleLines, onReorder],
  );

  return (
    <CardDndProvider lines={visibleLines} onSort={handleSort}>
      <ol
        ref={listRef}
        aria-label="Lines"
        className="mx-auto flex w-full max-w-[72ch] flex-col gap-2 p-4 md:p-6"
      >
        {visibleLines.map((line, index) => (
          <LineCard
            key={line.id}
            line={line}
            index={index}
            total={visibleLines.length}
            annotation={annotations.get(line.id)}
            onAction={(action) => {
              onAction(line.id, action);
            }}
          />
        ))}
      </ol>
    </CardDndProvider>
  );
}
