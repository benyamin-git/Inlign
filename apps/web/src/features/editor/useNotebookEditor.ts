import { useCallback, useEffect, useRef, useState } from "react";

import type { Line, Notebook } from "../../data/models.ts";
import { getNotebook, updateNotebook } from "../../data/notebooks.ts";
import {
  insertText,
  mergeWithNext,
  mergeWithPrevious,
  splitLine,
  type LineOpResult,
} from "./lineOps.ts";

export type EditorFocus = { lineId: string; offset: number; token: number };

type EditorState = { lines: Line[]; focus: EditorFocus };

function ensureLines(lines: Line[]): Line[] {
  return lines.length > 0 ? lines : [{ id: crypto.randomUUID(), text: "" }];
}

export type UseNotebookEditor = {
  lines: Line[];
  focus: EditorFocus;
  onChange: (lineId: string, text: string) => void;
  onSplit: (lineId: string, offset: number, end?: number) => void;
  onMergePrevious: (lineId: string) => void;
  onMergeNext: (lineId: string) => void;
  onNavigate: (lineId: string, direction: -1 | 1, offset: number) => void;
  onPaste: (lineId: string, offset: number, text: string, end?: number) => void;
};

/**
 * Local line state for one notebook. Persistence is deliberately kept in one
 * helper so the autosave milestone can debounce text writes without touching
 * the line operations.
 */
export function useNotebookEditor(notebook: Notebook): UseNotebookEditor {
  const [state, setState] = useState<EditorState>(() => {
    const lines = ensureLines(notebook.lines);

    return { lines, focus: { lineId: lines[0]!.id, offset: 0, token: 0 } };
  });
  const stateRef = useRef(state);
  const focusTokenRef = useRef(1);
  // A slow repository read must not clobber text the user already typed.
  const editedRef = useRef(false);

  const persist = useCallback(
    (lines: Line[]) => {
      void updateNotebook(notebook.id, { lines }).catch(() => {
        // Autosave will add retry and flush behavior; local state stays usable.
      });
    },
    [notebook.id],
  );

  const commitLines = useCallback(
    (lines: Line[], focus?: { lineId: string; offset: number }) => {
      const safeLines = ensureLines(lines);
      const nextFocus: EditorFocus = focus
        ? { ...focus, token: ++focusTokenRef.current }
        : stateRef.current.focus;
      const next: EditorState = { lines: safeLines, focus: nextFocus };

      editedRef.current = true;
      stateRef.current = next;
      setState(next);
      persist(safeLines);
    },
    [persist],
  );

  const commitFocus = useCallback((lineId: string, offset: number) => {
    const next: EditorState = {
      lines: stateRef.current.lines,
      focus: { lineId, offset, token: ++focusTokenRef.current },
    };

    stateRef.current = next;
    setState(next);
  }, []);

  const applyResult = useCallback(
    (result: LineOpResult | null) => {
      if (result) {
        commitLines(result.lines, result.focus);
      }
    },
    [commitLines],
  );

  const onChange = useCallback(
    (lineId: string, text: string) => {
      const current = stateRef.current;
      const index = current.lines.findIndex((line) => line.id === lineId);
      const line = current.lines[index];

      if (!line || line.text === text) {
        return;
      }

      const lines = current.lines.map((item, itemIndex) =>
        itemIndex === index ? { ...item, text } : item,
      );

      commitLines(lines);
    },
    [commitLines],
  );

  const onSplit = useCallback(
    (lineId: string, offset: number, end?: number) => {
      applyResult(splitLine(stateRef.current.lines, lineId, offset, end));
    },
    [applyResult],
  );

  const onMergePrevious = useCallback(
    (lineId: string) => {
      applyResult(mergeWithPrevious(stateRef.current.lines, lineId));
    },
    [applyResult],
  );

  const onMergeNext = useCallback(
    (lineId: string) => {
      applyResult(mergeWithNext(stateRef.current.lines, lineId));
    },
    [applyResult],
  );

  const onPaste = useCallback(
    (lineId: string, offset: number, text: string, end?: number) => {
      applyResult(insertText(stateRef.current.lines, lineId, offset, text, end));
    },
    [applyResult],
  );

  const onNavigate = useCallback(
    (lineId: string, direction: -1 | 1, offset: number) => {
      const lines = stateRef.current.lines;
      const index = lines.findIndex((line) => line.id === lineId);
      const target = lines[index + direction];

      if (index < 0 || !target) {
        return;
      }

      commitFocus(target.id, Math.max(0, Math.min(offset, target.text.length)));
    },
    [commitFocus],
  );

  // The sidebar list can be stale after edits, so the editor loads the stored
  // notebook itself and focuses its first line whenever it mounts.
  useEffect(() => {
    let cancelled = false;

    void getNotebook(notebook.id).then(
      (fresh) => {
        if (cancelled || editedRef.current || !fresh) {
          return;
        }

        const lines = ensureLines(fresh.lines);
        const currentFocus = stateRef.current.focus;
        // Keep the caret if its line survived; otherwise focus the first card.
        const focus = lines.some((line) => line.id === currentFocus.lineId)
          ? currentFocus
          : { lineId: lines[0]!.id, offset: 0, token: ++focusTokenRef.current };
        const next: EditorState = { lines, focus };

        stateRef.current = next;
        setState(next);
      },
      () => {
        // IndexedDB is unavailable; keep the lines passed in by the caller.
      },
    );

    return () => {
      cancelled = true;
    };
  }, [notebook.id]);

  return {
    lines: state.lines,
    focus: state.focus,
    onChange,
    onSplit,
    onMergePrevious,
    onMergeNext,
    onNavigate,
    onPaste,
  };
}
