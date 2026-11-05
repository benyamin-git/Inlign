import { useCallback, useEffect } from "react";

import type { Line, Notebook } from "../../data/models.ts";
import { LineCardList } from "./LineCardList.tsx";
import type { LineAction } from "./lineOps.ts";
import { useEngineEvaluation, type EngineEvaluator } from "./useEngineEvaluation.ts";
import { useNotebookEditor } from "./useNotebookEditor.ts";

export type NotebookEditorProps = {
  notebook: Notebook;
  /** Changes when the whole notebook table is restored, forcing a reload. */
  revision?: number;
  /** Optional engine used to annotate lines; null while the app starts up. */
  engine?: EngineEvaluator | null;
  /** Lets the app export the in-memory lines before autosave catches up. */
  onLinesChange?: ((lines: Line[]) => void) | undefined;
  /**
   * Registers a cancel for the active editor's pending autosave so a restore
   * can drop it before replacing storage. Receives null on unmount.
   */
  registerCancelPendingWrites?: ((cancel: (() => void) | null) => void) | undefined;
};

export function NotebookEditor({
  notebook,
  revision = 0,
  engine = null,
  onLinesChange,
  registerCancelPendingWrites,
}: NotebookEditorProps) {
  const {
    lines,
    focus,
    onChange,
    onSplit,
    onMergePrevious,
    onMergeNext,
    onNavigate,
    onPaste,
    onReorder,
    cancelPendingWrites,
  } = useNotebookEditor(notebook, revision);
  const annotations = useEngineEvaluation(engine, lines);

  const handleAction = useCallback(
    (lineId: string, action: LineAction) => {
      switch (action.type) {
        case "change":
          onChange(lineId, action.text);
          return;
        case "split":
          onSplit(lineId, action.offset, action.end);
          return;
        case "merge-previous":
          onMergePrevious(lineId);
          return;
        case "merge-next":
          onMergeNext(lineId);
          return;
        case "navigate":
          onNavigate(lineId, action.direction, action.offset ?? 0);
          return;
        case "paste":
          onPaste(lineId, action.offset, action.text, action.end);
      }
    },
    [onChange, onSplit, onMergePrevious, onMergeNext, onNavigate, onPaste],
  );

  useEffect(() => {
    onLinesChange?.(lines);
  }, [lines, onLinesChange]);

  useEffect(() => {
    registerCancelPendingWrites?.(cancelPendingWrites);

    return () => {
      registerCancelPendingWrites?.(null);
    };
  }, [cancelPendingWrites, registerCancelPendingWrites]);

  return (
    <LineCardList
      lines={lines}
      focus={focus}
      annotations={annotations}
      onAction={handleAction}
      onReorder={onReorder}
    />
  );
}
