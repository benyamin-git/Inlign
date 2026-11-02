import { useLayoutEffect, useRef, useState } from "react";

import type { Line } from "../../data/models.ts";
import { LineCard } from "./LineCard.tsx";
import type { LineAction } from "./lineOps.ts";
import type { EditorFocus } from "./useNotebookEditor.ts";

export type LineCardListProps = {
  lines: Line[];
  focus: EditorFocus | null;
  onAction: (lineId: string, action: LineAction) => void;
};

export function LineCardList({ lines, focus, onAction }: LineCardListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [fallback] = useState<Line>(() => ({ id: crypto.randomUUID(), text: "" }));

  // Defensive only: the editor state always holds at least one line.
  const visibleLines = lines.length > 0 ? lines : [fallback];

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

  return (
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
          onAction={(action) => {
            onAction(line.id, action);
          }}
        />
      ))}
    </ol>
  );
}
