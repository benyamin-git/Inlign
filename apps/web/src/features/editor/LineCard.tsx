import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import type { Line } from "../../data/models.ts";
import { GripIcon } from "../../ui/icons.tsx";
import type { LineAction } from "./lineOps.ts";
import { useLineKeys } from "./useLineKeys.ts";

export type LineCardProps = {
  line: Line;
  index: number;
  total: number;
  onAction: (action: LineAction) => void;
};

export function LineCard({ line, index, total, onAction }: LineCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { onKeyDown, onPaste } = useLineKeys({ index, total, onAction });

  const grow = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${String(textarea.scrollHeight)}px`;
  }, []);

  // Text changes can wrap to another row; measure after the browser lays the
  // new value out.
  useLayoutEffect(() => {
    grow();
  }, [grow, line.text]);

  // Width changes also reflow the text. Comparing width keeps the observer from
  // looping on the height writes it causes.
  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || typeof ResizeObserver === "undefined") {
      return;
    }

    let width = textarea.clientWidth;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry || entry.contentRect.width === width) {
        return;
      }

      width = entry.contentRect.width;
      grow();
    });

    observer.observe(textarea);

    return () => {
      observer.disconnect();
    };
  }, [grow]);

  return (
    <li className="flex items-start gap-2 rounded-card border border-outline bg-surface-container px-3 py-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary md:py-2">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-5 shrink-0 items-center justify-center text-on-surface-variant opacity-70"
      >
        <GripIcon className="h-4 w-4" />
      </span>
      <textarea
        ref={textareaRef}
        aria-label={`Line ${String(index + 1)}`}
        data-line-id={line.id}
        rows={1}
        value={line.text}
        spellCheck={false}
        autoComplete="off"
        className="min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-6 text-on-surface outline-none focus-visible:outline-none"
        onChange={(event) => {
          onAction({ type: "change", text: event.target.value });
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
    </li>
  );
}
