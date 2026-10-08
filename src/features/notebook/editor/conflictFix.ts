import type { Extension } from '@codemirror/state'
import { EditorView, type KeyBinding } from '@codemirror/view'
import type { Annotation, AnnotationFix } from '@/engine/types'
import { annotationField } from './annotations'

export function applyFix(view: EditorView, fix: AnnotationFix): void {
  view.dispatch({
    changes: { from: fix.from, to: fix.to, insert: fix.insert },
    selection: { anchor: fix.from + fix.insert.length },
  })
}

function fixAtCursor(view: EditorView): boolean {
  const annotations = view.state.field(annotationField, false)
  if (annotations === undefined) return false
  const { main } = view.state.selection
  if (!main.empty) return false
  const annotation: Annotation | undefined = annotations.find(
    (candidate) =>
      candidate.fix !== undefined && main.head >= candidate.from && main.head <= candidate.to,
  )
  if (annotation?.fix === undefined) return false
  applyFix(view, annotation.fix)
  return true
}

export function conflictFixKeymap(): readonly KeyBinding[] {
  return [{ key: 'Enter', run: fixAtCursor }]
}

export function conflictFixClicks(): Extension {
  return EditorView.domEventHandlers({
    click: (event, view) => {
      const target = event.target
      const button =
        target instanceof HTMLElement ? target.closest<HTMLElement>('button.cm-ann-fix') : null
      if (button === null) return false
      const line = Number(button.dataset.line)
      const annotations = view.state.field(annotationField, false)
      const annotation = annotations?.find((candidate) => candidate.line === line)
      if (annotation?.fix === undefined) return false
      event.preventDefault()
      applyFix(view, annotation.fix)
      return true
    },
  })
}
