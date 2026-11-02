import { useCallback } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

import type { LineAction } from "./lineOps.ts";

export type UseLineKeysOptions = {
  index: number;
  total: number;
  onAction: (action: LineAction) => void;
};

export type UseLineKeys = {
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
};

function hasModifier(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.shiftKey || event.metaKey || event.ctrlKey || event.altKey;
}

function isComposing(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

/**
 * Approximate whether a caret is on the only visual row. Measuring wrapped rows
 * from the textarea height avoids a caret mirror; when a line wraps, only the
 * text start and end are treated as row boundaries.
 */
function fitsOneRow(textarea: HTMLTextAreaElement): boolean {
  const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight);

  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return true;
  }

  return textarea.scrollHeight <= lineHeight * 1.5;
}

/**
 * Keyboard and clipboard intents for a single card. The textarea keeps native
 * undo; only structural moves that would cross a card boundary are handled.
 */
export function useLineKeys({ index, total, onAction }: UseLineKeysOptions): UseLineKeys {
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposing(event)) {
        return;
      }

      const textarea = event.currentTarget;

      if (event.key === "Enter") {
        // A card is one logical line; Enter never inserts a newline even when a
        // modifier is held. Only the plain shortcut splits.
        event.preventDefault();

        if (!hasModifier(event)) {
          onAction({ type: "split", offset: textarea.selectionStart });
        }

        return;
      }

      if (hasModifier(event)) {
        return;
      }

      const collapsed = textarea.selectionStart === textarea.selectionEnd;

      if (event.key === "Backspace") {
        if (collapsed && textarea.selectionStart === 0) {
          event.preventDefault();
          onAction({ type: "merge-previous" });
        }

        return;
      }

      if (event.key === "Delete") {
        if (collapsed && textarea.selectionStart === textarea.value.length) {
          event.preventDefault();
          onAction({ type: "merge-next" });
        }

        return;
      }

      if (event.key === "ArrowUp" && collapsed && index > 0) {
        if (fitsOneRow(textarea) || textarea.selectionStart === 0) {
          event.preventDefault();
          onAction({ type: "navigate", direction: -1, offset: textarea.selectionStart });
        }

        return;
      }

      if (event.key === "ArrowDown" && collapsed && index < total - 1) {
        if (fitsOneRow(textarea) || textarea.selectionStart === textarea.value.length) {
          event.preventDefault();
          onAction({ type: "navigate", direction: 1, offset: textarea.selectionStart });
        }
      }
    },
    [index, total, onAction],
  );

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const text = event.clipboardData.getData("text");

      if (!/[\r\n]/.test(text)) {
        return;
      }

      event.preventDefault();
      onAction({ type: "paste", offset: event.currentTarget.selectionStart, text });
    },
    [onAction],
  );

  return { onKeyDown, onPaste };
}
