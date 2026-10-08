import { StateEffect, StateField, type Extension, type Range } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import type { Annotation } from '@/engine/types'

const annotationEffect = StateEffect.define<Annotation[]>()

const narrowEffect = StateEffect.define<boolean>()

export const setAnnotations = (annotations: Annotation[]): StateEffect<Annotation[]> =>
  annotationEffect.of(annotations)

export const setNarrow = (narrow: boolean): StateEffect<boolean> => narrowEffect.of(narrow)

export const annotationField = StateField.define<Annotation[]>({
  create: () => [],
  update: (annotations, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(annotationEffect)) return effect.value
    }
    return annotations
  },
})

export const narrowField = StateField.define<boolean>({
  create: () => false,
  update: (narrow, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(narrowEffect)) return effect.value
    }
    return narrow
  },
})

function fixButton(annotation: Annotation): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className =
    annotation.kind === 'conflict'
      ? 'cm-ann-fix cm-ann-conflict-note'
      : 'cm-ann-fix cm-ann-error-note'
  const mark = annotation.kind === 'conflict' ? '≠' : '↩'
  button.textContent = `${mark} ${annotation.expected ?? annotation.text}`
  button.dataset.line = String(annotation.line)
  return button
}

function warningNote(text: string): HTMLSpanElement {
  const element = document.createElement('span')
  element.className = 'cm-ann-note'
  element.textContent = text
  return element
}

class AnnotationWidget extends WidgetType {
  private readonly annotation: Annotation
  private readonly narrow: boolean

  constructor(annotation: Annotation, narrow: boolean) {
    super()
    this.annotation = annotation
    this.narrow = narrow
  }

  eq(other: AnnotationWidget): boolean {
    return other.annotation === this.annotation && other.narrow === this.narrow
  }

  ignoreEvent(): boolean {
    return false
  }

  toDOM(): HTMLElement {
    const { annotation, narrow } = this
    if (annotation.kind === 'result') {
      const element = document.createElement(narrow ? 'div' : 'span')
      element.className = narrow ? 'cm-ann-result cm-ann-result-block' : 'cm-ann-result'
      element.textContent = `= ${annotation.text}`
      return element
    }
    if (annotation.kind === 'conflict') return fixButton(annotation)
    if (annotation.kind === 'error') {
      if (annotation.fix !== undefined) return fixButton(annotation)
      return warningNote('⚠')
    }
    return warningNote(annotation.text === '' ? '…' : `= ${annotation.text}`)
  }
}

export function annotationDecorations(annotations: Annotation[], narrow: boolean): DecorationSet {
  const ranges: Range<Decoration>[] = []
  for (const annotation of annotations) {
    if (annotation.kind === 'conflict' && annotation.from < annotation.to) {
      ranges.push(
        Decoration.mark({ class: 'cm-ann-conflict' }).range(annotation.from, annotation.to),
      )
    }
    const widget = new AnnotationWidget(annotation, narrow)
    ranges.push(
      Decoration.widget({
        widget,
        side: 1,
        block: narrow && annotation.kind === 'result',
      }).range(annotation.to),
    )
  }
  return Decoration.set(ranges, true)
}

export const annotationsExtension: Extension = [
  annotationField,
  narrowField,
  EditorView.decorations.compute([annotationField, narrowField], (state) =>
    annotationDecorations(state.field(annotationField), state.field(narrowField)),
  ),
]
