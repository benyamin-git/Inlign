import { history, undo } from '@codemirror/commands'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Annotation, SolveSettings } from '@/engine/types'
import { MockWorker } from '@/test/mockWorker'
import { NotebookEditor } from '../NotebookEditor'
import { annotationField, annotationsExtension, setAnnotations } from './annotations'
import { applyFix, conflictFixKeymap } from './conflictFix'
import { annotationDetail, annotationTooltips, type EditorLabels } from './tooltips'

const settings: SolveSettings = { angleMode: 'radians', precision: 12, toleranceOverride: null }

const conflict: Annotation = {
  line: 0,
  from: 0,
  to: 7,
  kind: 'conflict',
  text: '2.019',
  expected: '2.019',
  fix: { from: 4, to: 7, insert: '2.019' },
}

const labels: EditorLabels = {
  conflict: (expected) => `Conflicts with the computed value (expected ${expected})`,
  duplicate: (expected) => `Duplicates an earlier definition (expected ${expected})`,
  replace: 'Replace with computed',
  error: 'This line cannot be computed',
  unresolved: 'Waiting for values',
}

function createView(doc: string, extensions: Extension[] = []): EditorView {
  return new EditorView({
    state: EditorState.create({ doc, extensions: [history(), ...extensions] }),
  })
}

describe('applyFix', () => {
  it('replaces exactly the flagged range and is undoable', () => {
    const view = createView('t = 2.1')
    const fix = conflict.fix
    if (fix === undefined) throw new Error('conflict fix missing')
    applyFix(view, fix)
    expect(view.state.doc.toString()).toBe('t = 2.019')
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('t = 2.1')
    view.destroy()
  })
})

describe('conflictFixKeymap', () => {
  it('applies the fix when the cursor sits on the conflict', () => {
    const view = createView('t = 2.1\nx = 1', [annotationField, keymap.of(conflictFixKeymap())])
    view.dispatch({ effects: setAnnotations([conflict]) })
    const binding = conflictFixKeymap()[0]
    if (binding?.run === undefined) throw new Error('Enter binding missing')

    view.dispatch({ selection: { anchor: 1 } })
    expect(binding.run(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('t = 2.019\nx = 1')

    view.dispatch({ selection: { anchor: 10 } })
    expect(binding.run(view)).toBe(false)
    view.destroy()
  })
})

describe('fix visibility follows the caret', () => {
  it('shows a conflict fix only while the caret is on its line', () => {
    const view = createView('t = 2.1\nx = 1', [annotationsExtension])
    view.dispatch({ effects: setAnnotations([conflict]) })
    expect(view.dom.querySelector('button.cm-ann-fix')).not.toBeNull()

    view.dispatch({ selection: { anchor: 10 } })
    expect(view.dom.querySelector('button.cm-ann-fix')).toBeNull()

    view.dispatch({ selection: { anchor: 1 } })
    expect(view.dom.querySelector('button.cm-ann-fix')).not.toBeNull()
    view.destroy()
  })

  it('labels a fix that appears when the caret moves onto its line', () => {
    const moved: Annotation = {
      line: 1,
      from: 6,
      to: 13,
      kind: 'conflict',
      text: '2.019',
      expected: '2.019',
      fix: { from: 10, to: 13, insert: '2.019' },
    }
    const view = createView('x = 1\nt = 2.1', [annotationsExtension, annotationTooltips(labels)])
    view.dispatch({ effects: setAnnotations([moved]) })
    expect(view.dom.querySelector('button.cm-ann-fix')).toBeNull()

    view.dispatch({ selection: { anchor: 7 } })
    const button = view.dom.querySelector<HTMLButtonElement>('button.cm-ann-fix')
    expect(button?.getAttribute('aria-label')).toBe(
      'Conflicts with the computed value (expected 2.019). Replace with computed',
    )
    view.destroy()
  })
})

describe('annotationDetail', () => {
  it('describes conflicts, duplicates, errors, and unresolved lines', () => {
    expect(annotationDetail(conflict, labels)).toBe(
      'Conflicts with the computed value (expected 2.019)',
    )
    expect(
      annotationDetail(
        { line: 1, from: 0, to: 1, kind: 'error', text: 'b + 1', expected: 'b + 1' },
        labels,
      ),
    ).toBe('Duplicates an earlier definition (expected b + 1)')
    expect(annotationDetail({ line: 1, from: 0, to: 1, kind: 'error', text: '' }, labels)).toBe(
      'This line cannot be computed',
    )
    expect(
      annotationDetail({ line: 1, from: 0, to: 1, kind: 'unresolved', text: '1 + y' }, labels),
    ).toBe('Waiting for values')
    expect(
      annotationDetail({ line: 1, from: 0, to: 1, kind: 'result', text: '7' }, labels),
    ).toBeNull()
  })
})

describe('NotebookEditor conflict handling', () => {
  beforeEach(() => {
    MockWorker.reset()
    vi.stubGlobal('Worker', MockWorker)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders a conflict with accessible text and applies the fix on click', () => {
    const onChange = vi.fn()
    render(<NotebookEditor value="t = 2.1" settings={settings} onChange={onChange} />)
    const worker = MockWorker.instances[0]
    if (worker === undefined) throw new Error('worker was not created')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    act(() => {
      worker.emit({ version: 1, annotations: [conflict] })
    })

    expect(screen.getByText('≠ 2.019')).toBeInTheDocument()
    const button = screen.getByRole('button', {
      name: 'Conflicts with the computed value (expected 2.019). Replace with computed',
    })
    fireEvent.click(button)
    expect(onChange).toHaveBeenCalledWith('t = 2.019')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    act(() => {
      worker.emit({ version: 2, annotations: [] })
    })
    expect(screen.queryByText('≠ 2.019')).not.toBeInTheDocument()
  })
})
