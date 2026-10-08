import type { Extension } from '@codemirror/state'
import { EditorView, hoverTooltip } from '@codemirror/view'
import type { Annotation } from '@/engine/types'
import { annotationField } from './annotations'
import { applyFix } from './conflictFix'

export interface EditorLabels {
  conflict(expected: string): string
  duplicate(expected: string): string
  replace: string
  error: string
  unresolved: string
}

export function annotationDetail(annotation: Annotation, labels: EditorLabels): string | null {
  if (annotation.kind === 'conflict') return labels.conflict(annotation.expected ?? annotation.text)
  if (annotation.kind === 'error') {
    return annotation.expected === undefined ? labels.error : labels.duplicate(annotation.expected)
  }
  if (annotation.kind === 'unresolved') return labels.unresolved
  return null
}

function tooltipDom(
  view: EditorView,
  annotation: Annotation,
  message: string,
  labels: EditorLabels,
): HTMLElement {
  const dom = document.createElement('div')
  dom.className = 'cm-ann-tooltip'
  dom.setAttribute('role', 'tooltip')

  const text = document.createElement('p')
  text.className = 'cm-ann-tooltip-text'
  text.textContent = message
  dom.append(text)

  const fix = annotation.fix
  if (fix !== undefined) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-ann-tooltip-fix'
    button.textContent = labels.replace
    button.addEventListener('click', (event) => {
      event.preventDefault()
      applyFix(view, fix)
    })
    dom.append(button)
  }
  return dom
}

export function syncAnnotationLabels(view: EditorView, labels: EditorLabels): void {
  const annotations = view.state.field(annotationField, false) ?? []
  for (const button of view.dom.querySelectorAll<HTMLButtonElement>('button.cm-ann-fix')) {
    const annotation = annotations.find(
      (candidate) => candidate.line === Number(button.dataset.line),
    )
    if (annotation === undefined) continue
    const expected = annotation.expected ?? annotation.text
    const message =
      annotation.kind === 'conflict' ? labels.conflict(expected) : labels.duplicate(expected)
    button.setAttribute('aria-label', `${message}. ${labels.replace}`)
  }
}

const tooltipTheme = EditorView.theme({
  '.cm-ann-tooltip': {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxWidth: '16rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    backgroundColor: 'var(--md-sys-color-surface-container-highest)',
    color: 'var(--md-sys-color-on-surface)',
    border: '1px solid var(--md-sys-color-outline-variant)',
    borderRadius: 'var(--app-radius-sm)',
  },
  '.cm-ann-tooltip-text': { margin: 0 },
  '.cm-ann-tooltip-fix': {
    alignSelf: 'flex-start',
    font: 'inherit',
    color: 'var(--md-sys-color-primary)',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
})

export function annotationTooltips(labels: EditorLabels): Extension {
  return [
    hoverTooltip(
      (view, pos) => {
        const annotations = view.state.field(annotationField, false)
        if (annotations === undefined) return null
        const annotation = annotations.find(
          (candidate) =>
            candidate.kind !== 'result' && pos >= candidate.from && pos <= candidate.to,
        )
        if (annotation === undefined) return null
        const message = annotationDetail(annotation, labels)
        if (message === null) return null
        return {
          pos: annotation.from,
          end: annotation.to,
          above: true,
          create: (tooltipView) => ({
            dom: tooltipDom(tooltipView, annotation, message, labels),
          }),
        }
      },
      { hideOn: (transaction) => transaction.docChanged },
    ),
    EditorView.updateListener.of((update) => {
      if (update.state.field(annotationField) !== update.startState.field(annotationField)) {
        syncAnnotationLabels(update.view, labels)
      }
    }),
    tooltipTheme,
  ]
}
