import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Annotation, SolveSettings } from '@/engine/types'
import { MockWorker } from '@/test/mockWorker'
import { NotebookEditor } from '../NotebookEditor'

const settings: SolveSettings = { angleMode: 'radians', precision: 12, toleranceOverride: null }

const result: Annotation = { line: 0, from: 0, to: 5, kind: 'result', text: '7' }

function firstWorker(): MockWorker {
  const worker = MockWorker.instances[0]
  if (worker === undefined) throw new Error('worker was not created')
  return worker
}

beforeEach(() => {
  MockWorker.reset()
  vi.stubGlobal('Worker', MockWorker)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('NotebookEditor', () => {
  it('solves the initial document and renders worker annotations', () => {
    render(<NotebookEditor value="3 + 4" settings={settings} onChange={() => undefined} />)
    const worker = firstWorker()
    expect(screen.getByRole('textbox')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(worker.postMessage).toHaveBeenCalledWith({ version: 1, text: '3 + 4', settings })

    act(() => {
      worker.emit({ version: 1, annotations: [result] })
    })
    expect(screen.getByText('= 7')).toBeInTheDocument()
  })

  it('re-solves external value changes and reports them through onChange', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <NotebookEditor value="3 + 4" settings={settings} onChange={onChange} />,
    )
    const worker = firstWorker()
    act(() => {
      vi.advanceTimersByTime(200)
    })

    rerender(<NotebookEditor value="2 + 2" settings={settings} onChange={onChange} />)
    expect(onChange).toHaveBeenCalledWith('2 + 2')
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      version: 2,
      text: '2 + 2',
      settings,
    })
  })

  it('places result widgets on their own line when the viewport is narrow', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList)

    render(<NotebookEditor value="3 + 4" settings={settings} onChange={() => undefined} />)
    const worker = firstWorker()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    act(() => {
      worker.emit({ version: 1, annotations: [result] })
    })
    expect(screen.getByText('= 7')).toHaveClass('cm-ann-result-block')
  })
})
