import { useCallback, useEffect } from "react";

import type { Line, Notebook } from "../../data/models.ts";
import { LineCardList } from "./LineCardList.tsx";
import type { LineAction } from "./lineOps.ts";
import { useNotebookEditor } from "./useNotebookEditor.ts";

export type NotebookEditorProps = {
  notebook: Notebook;
  /** Changes when the whole notebook table is restored, forcing a reload. */
  revision?: number;
  /** Lets the app export the in-memory lines before autosave catches up. */
  onLinesChange?: ((lines: Line[]) => void) | undefined;
};

export function NotebookEditor({ notebook, revision = 0, onLinesChange }: NotebookEditorProps) {
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
  } = useNotebookEditor(notebook, revision);

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

  return <LineCardList lines={lines} focus={focus} onAction={handleAction} onReorder={onReorder} />;
}
