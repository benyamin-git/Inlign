import { useEffect, useMemo, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import type { SolveSettings } from '@/engine/types'
import { useI18n } from '@/i18n/I18nProvider'
import { useIsNarrow } from '@/lib/media'
import { setAnnotations, setNarrow } from './editor/annotations'
import { conflictFixClicks, conflictFixKeymap } from './editor/conflictFix'
import { createEditorExtensions } from './editor/setup'
import { annotationTooltips, type EditorLabels } from './editor/tooltips'
import { useSolveWorker } from './useSolveWorker'

export interface NotebookEditorProps {
  value: string
  settings: SolveSettings
  onChange: (value: string) => void
}

export function NotebookEditor({ value, settings, onChange }: NotebookEditorProps) {
  const { t } = useI18n()
  const narrow = useIsNarrow()
  const { annotations, requestSolve } = useSolveWorker(settings)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const label = t('editor.ariaLabel')
  const labels = useMemo<EditorLabels>(
    () => ({
      conflict: (expected) => t('editor.conflictDetail', { expected }),
      duplicate: (expected) => t('editor.duplicateDetail', { expected }),
      replace: t('editor.replaceWithComputed'),
      error: t('editor.errorDetail'),
      unresolved: t('editor.unresolvedDetail'),
    }),
    [t],
  )

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    const parent = containerRef.current
    if (parent === null) return
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          keymap.of(conflictFixKeymap()),
          conflictFixClicks(),
          annotationTooltips(labels),
          createEditorExtensions({
            label,
            onDocChange: (doc) => {
              onChangeRef.current(doc)
              requestSolve(doc)
            },
          }),
        ],
      }),
    })
    viewRef.current = view
    requestSolve(view.state.doc.toString())
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [label, labels, requestSolve])

  useEffect(() => {
    const view = viewRef.current
    if (view === null) return
    const current = view.state.doc.toString()
    if (value === current) return
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setNarrow(narrow) })
  }, [narrow])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setAnnotations(annotations) })
  }, [annotations])

  return <div ref={containerRef} className="h-full min-h-0" />
}
