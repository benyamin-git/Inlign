import { useCallback } from "react";

import type { Notebook } from "../../data/models.ts";
import { LineCardList } from "./LineCardList.tsx";
import type { LineAction } from "./lineOps.ts";
import { useNotebookEditor } from "./useNotebookEditor.ts";

export type NotebookEditorProps = {
  notebook: Notebook;
};

export function NotebookEditor({ notebook }: NotebookEditorProps) {
  const { lines, focus, onChange, onSplit, onMergePrevious, onMergeNext, onNavigate, onPaste } =
    useNotebookEditor(notebook);

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

  return <LineCardList lines={lines} focus={focus} onAction={handleAction} />;
}
