import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { SolveSettings } from '@/engine/types'
import { useI18n } from '@/i18n/I18nProvider'
import { useIsNarrow } from '@/lib/media'
import { setAnnotations, setNarrow } from './editor/annotations'
import { createEditorExtensions } from './editor/setup'
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
        extensions: createEditorExtensions({
          label,
          onDocChange: (doc) => {
            onChangeRef.current(doc)
            requestSolve(doc)
          },
        }),
      }),
    })
    viewRef.current = view
    requestSolve(view.state.doc.toString())
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [label, requestSolve])

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
