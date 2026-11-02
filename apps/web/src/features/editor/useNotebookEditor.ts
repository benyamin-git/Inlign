import { useCallback, useEffect, useRef, useState } from "react";

import type { Line, Notebook } from "../../data/models.ts";
import { getNotebook, updateNotebook } from "../../data/notebooks.ts";
import { useAutosave } from "./useAutosave.ts";
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
  onReorder: (lines: Line[]) => void;
  /** Drops the debounced text write without saving it. */
  cancelPendingWrites: () => void;
};

/**
 * Local line state for one notebook. Text writes are debounced; structural
 * writes go straight to storage so a pending text snapshot cannot replace a
 * newer set of lines.
 */
export function useNotebookEditor(notebook: Notebook, revision = 0): UseNotebookEditor {
  const [state, setState] = useState<EditorState>(() => {
    const lines = ensureLines(notebook.lines);

    return { lines, focus: { lineId: lines[0]!.id, offset: 0, token: 0 } };
  });
  const stateRef = useRef(state);
  const focusTokenRef = useRef(1);
  const revisionRef = useRef(revision);
  // A slow repository read must not clobber text the user already typed.
  const editedRef = useRef(false);
  const { schedule: scheduleAutosave, cancel: cancelAutosave } = useAutosave(notebook.id);

  const commitText = useCallback(
    (lines: Line[]) => {
      const safeLines = ensureLines(lines);
      const next: EditorState = { lines: safeLines, focus: stateRef.current.focus };

      editedRef.current = true;
      stateRef.current = next;
      setState(next);
      scheduleAutosave(safeLines);
    },
    [scheduleAutosave],
  );

  const commitStructure = useCallback(
    (lines: Line[], focus?: { lineId: string; offset: number }) => {
      const safeLines = ensureLines(lines);
      const nextFocus: EditorFocus = focus
        ? { ...focus, token: ++focusTokenRef.current }
        : stateRef.current.focus;
      const next: EditorState = { lines: safeLines, focus: nextFocus };

      // Drop a text snapshot scheduled before this structure change. The
      // structure write below already carries the newest local lines.
      cancelAutosave();
      editedRef.current = true;
      stateRef.current = next;
      setState(next);
      void updateNotebook(notebook.id, { lines: safeLines }).catch(() => {
        // A later edit retries; local state stays usable in the meantime.
      });
    },
    [cancelAutosave, notebook.id],
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
        commitStructure(result.lines, result.focus);
      }
    },
    [commitStructure],
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

      commitText(lines);
    },
    [commitText],
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

  // A drop reorders the whole document and writes immediately; only the caret
  // line survives unchanged, so the focus token is left alone.
  const onReorder = useCallback(
    (lines: Line[]) => {
      commitStructure(lines);
    },
    [commitStructure],
  );

  // The sidebar list can be stale after edits, so the editor loads the stored
  // notebook itself and focuses its first line whenever it mounts. A restore
  // bumps `revision`, which must reload even when local edits are pending and
  // must drop the old debounced write so it cannot overwrite the import.
  useEffect(() => {
    let cancelled = false;
    const restored = revisionRef.current !== revision;

    revisionRef.current = revision;

    if (restored) {
      cancelAutosave();
      editedRef.current = false;
    }

    void getNotebook(notebook.id).then(
      (fresh) => {
        if (cancelled || (!restored && editedRef.current) || !fresh) {
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
  }, [notebook.id, revision, cancelAutosave]);

  return {
    lines: state.lines,
    focus: state.focus,
    onChange,
    onSplit,
    onMergePrevious,
    onMergeNext,
    onNavigate,
    onPaste,
    onReorder,
    cancelPendingWrites: cancelAutosave,
  };
}
