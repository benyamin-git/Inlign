import { EditorState } from '@codemirror/state'
import type { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import type { Annotation } from '@/engine/types'
import {
  annotationDecorations,
  annotationField,
  narrowField,
  setAnnotations,
  setNarrow,
} from './annotations'

const result: Annotation = { line: 0, from: 0, to: 5, kind: 'result', text: '7' }
const conflict: Annotation = {
  line: 1,
  from: 6,
  to: 13,
  kind: 'conflict',
  text: '2.019',
  expected: '2.019',
  fix: { from: 10, to: 13, insert: '2.019' },
}
const duplicate: Annotation = {
  line: 2,
  from: 15,
  to: 20,
  kind: 'error',
  text: 'b + 1',
  expected: 'b + 1',
  fix: { from: 17, to: 20, insert: 'b + 1' },
}
const error: Annotation = { line: 3, from: 22, to: 26, kind: 'error', text: '' }
const unresolved: Annotation = { line: 4, from: 28, to: 33, kind: 'unresolved', text: '1 + y' }
const emptyUnresolved: Annotation = { line: 5, from: 35, to: 38, kind: 'unresolved', text: '' }

interface Entry {
  from: number
  to: number
  decoration: Decoration
}

function entries(set: DecorationSet): Entry[] {
  const found: Entry[] = []
  set.between(0, 1000, (from, to, decoration) => {
    found.push({ from, to, decoration })
  })
  return found
}

function widgets(
  entries: Entry[],
): Array<{ from: number; to: number; text: string; block: boolean }> {
  return entries
    .filter((entry) => entry.decoration.spec.widget !== undefined)
    .map((entry) => {
      const widget = entry.decoration.spec.widget as { toDOM(view: EditorView): HTMLElement }
      return {
        from: entry.from,
        to: entry.to,
        text: widget.toDOM({} as EditorView).textContent ?? '',
        block: entry.decoration.spec.block === true,
      }
    })
}

describe('annotationDecorations', () => {
  it('maps a result to a muted inline widget at the line end', () => {
    const set = annotationDecorations([result], false)
    const [widget] = widgets(entries(set))
    expect(widget).toEqual({ from: 5, to: 5, text: '= 7', block: false })
    expect(entries(set).every((entry) => entry.decoration.spec.class !== 'cm-ann-conflict')).toBe(
      true,
    )
  })

  it('places result widgets as indented block widgets when narrow', () => {
    const set = annotationDecorations([result], true)
    const [widget] = widgets(entries(set))
    expect(widget?.block).toBe(true)
    expect(widget?.text).toBe('= 7')
  })

  it('underlines a conflict and offers the expected value inline', () => {
    const set = annotationDecorations([conflict], false)
    const mark = entries(set).find((entry) => entry.decoration.spec.class === 'cm-ann-conflict')
    expect(mark?.from).toBe(6)
    expect(mark?.to).toBe(13)
    const [widget] = widgets(entries(set))
    expect(widget?.text).toBe('≠ 2.019')
  })

  it('renders fixable duplicates as error notes and bare errors as a warning mark', () => {
    const set = annotationDecorations([duplicate, error], false)
    const found = widgets(entries(set))
    expect(found.map((widget) => widget.text)).toEqual(['↩ b + 1', '⚠'])
  })

  it('shows unresolved symbolic text or a quiet ellipsis', () => {
    const set = annotationDecorations([unresolved, emptyUnresolved], false)
    const found = widgets(entries(set))
    expect(found.map((widget) => widget.text)).toEqual(['= 1 + y', '…'])
  })
})

describe('annotation state fields', () => {
  it('applies annotation and narrow effects', () => {
    let state = EditorState.create({ doc: 'x = 1', extensions: [annotationField, narrowField] })
    expect(state.field(annotationField)).toEqual([])
    expect(state.field(narrowField)).toBe(false)
    state = state.update({ effects: setAnnotations([result]) }).state
    state = state.update({ effects: setNarrow(true) }).state
    expect(state.field(annotationField)).toEqual([result])
    expect(state.field(narrowField)).toBe(true)
  })
})
