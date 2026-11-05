import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Line } from "../../data/models.ts";
import type { LineEvaluation } from "../../engine/protocol.ts";
import { GripIcon } from "../../ui/icons.tsx";
import type { LineAction } from "./lineOps.ts";
import { highlightMath } from "./mathSyntax.ts";
import { useLineKeys } from "./useLineKeys.ts";

export type LineCardProps = {
  line: Line;
  index: number;
  total: number;
  annotation?: LineEvaluation | undefined;
  onAction: (action: LineAction) => void;
};

export function LineCard({ line, index, total, annotation, onAction }: LineCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [caretAtEnd, setCaretAtEnd] = useState(false);
  const messageId = useId();
  const { onKeyDown, onPaste } = useLineKeys({ index, total, onAction });
  const tokens = useMemo(() => highlightMath(line.text), [line.text]);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: line.id });

  const error = annotation?.status === "error" ? annotation.error : undefined;
  const suggestion = annotation?.status === "incomplete" ? annotation.suggestion : undefined;
  const dimmed = annotation?.status === "skipped";
  const visibleSuggestion = focused && caretAtEnd ? suggestion : undefined;
  const suggestionText = visibleSuggestion?.display;
  const mark = dimmed
    ? null
    : error !== undefined
      ? { type: "error" as const, text: error }
      : suggestionText !== undefined
        ? { type: "suggestion" as const, text: suggestionText }
        : null;
  const separator = line.text.length > 0 && !/\s$/.test(line.text) ? " " : null;
  const description =
    error !== undefined
      ? `Error: ${error}.`
      : visibleSuggestion !== undefined
        ? `Suggestion: ${visibleSuggestion.display}. Press Tab to accept ${visibleSuggestion.insert}.`
        : undefined;

  const grow = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const textareaHeight = textarea.scrollHeight;
    const highlightHeight = highlightRef.current?.scrollHeight ?? 0;
    textarea.style.height = `${String(Math.max(textareaHeight, highlightHeight))}px`;
  }, []);

  const updateCaret = useCallback((textarea: HTMLTextAreaElement) => {
    setCaretAtEnd(
      textarea.selectionStart === textarea.selectionEnd &&
        textarea.selectionStart === textarea.value.length,
    );
  }, []);

  // Text or annotation changes can wrap to another row; measure after the
  // browser lays the new value out.
  useLayoutEffect(() => {
    grow();
  }, [dimmed, error, grow, line.text, suggestionText]);

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

  // A late webfont swap changes the text metrics after the initial measure.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    const ready = fonts?.ready;

    if (ready === undefined) {
      return;
    }

    let cancelled = false;

    void ready.then(() => {
      if (!cancelled) {
        grow();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [grow]);

  return (
    <li
      ref={setNodeRef}
      data-line-id={line.id}
      data-engine-status={annotation?.status ?? "none"}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`relative flex items-center gap-2 rounded-card border px-3 py-3 focus-within:outline-2 focus-within:outline-offset-2 md:py-2 ${
        error === undefined
          ? "border-outline focus-within:outline-primary"
          : "border-loss focus-within:outline-loss"
      } ${isDragging ? "z-10 border-primary bg-surface-container-high" : "bg-surface-container"}`}
    >
      <button
        {...attributes}
        {...listeners}
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Move line ${String(index + 1)}`}
        data-line-grip=""
        className="flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-button text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:h-12 pointer-coarse:w-12"
      >
        <GripIcon className="h-6 w-6" />
      </button>
      {/* The transparent textarea sits exactly over a colored token layer. */}
      <div className="relative min-h-6 w-full min-w-0">
        <div
          ref={highlightRef}
          aria-hidden="true"
          data-line-highlight=""
          className={`pointer-events-none absolute inset-0 select-none overflow-hidden break-words whitespace-pre-wrap text-base leading-6 forced-colors:hidden ${
            dimmed ? "text-on-surface-variant" : "text-on-surface"
          }`}
        >
          {dimmed
            ? line.text
            : tokens.map((token, tokenIndex) =>
                token.type === "text" ? (
                  token.text
                ) : (
                  <span
                    key={tokenIndex}
                    className={token.type === "operator" ? "text-tertiary" : "text-primary"}
                  >
                    {token.text}
                  </span>
                ),
              )}
          {mark === null ? null : (
            <>
              {separator}
              <span
                data-line-annotation={mark.type}
                className={mark.type === "error" ? "text-loss" : "text-on-surface-variant"}
              >
                {mark.text}
              </span>
            </>
          )}
        </div>
        <textarea
          ref={textareaRef}
          aria-label={`Line ${String(index + 1)}`}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={description === undefined ? undefined : messageId}
          data-line-id={line.id}
          rows={1}
          value={line.text}
          spellCheck={false}
          autoComplete="off"
          className="relative block min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-6 text-transparent caret-on-surface outline-none selection:bg-primary/30 focus-visible:outline-none"
          onChange={(event) => {
            onAction({ type: "change", text: event.target.value });
          }}
          onFocus={(event) => {
            setFocused(true);
            updateCaret(event.currentTarget);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          onSelect={(event) => {
            updateCaret(event.currentTarget);
          }}
          onKeyUp={(event) => {
            updateCaret(event.currentTarget);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        {description === undefined ? null : (
          <p id={messageId} className="sr-only">
            {description}
          </p>
        )}
      </div>
    </li>
  );
}
