import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Annotation, SolveSettings } from '@/engine/types'
import { MockWorker } from '@/test/mockWorker'
import { useSolveWorker } from '../useSolveWorker'

const settings: SolveSettings = { angleMode: 'radians', precision: 12, toleranceOverride: null }

const annotation: Annotation = { line: 0, from: 0, to: 5, kind: 'result', text: '7' }

beforeEach(() => {
  MockWorker.reset()
  vi.stubGlobal('Worker', MockWorker)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useSolveWorker', () => {
  it('debounces requests and posts an incrementing version', () => {
    const { result } = renderHook(() => useSolveWorker(settings))
    const worker = MockWorker.instances[0]
    if (worker === undefined) throw new Error('worker was not created')

    act(() => {
      result.current.requestSolve('3 + 4')
      result.current.requestSolve('3 + 5')
    })
    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(worker.postMessage).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    expect(worker.postMessage).toHaveBeenCalledWith({
      version: 1,
      text: '3 + 5',
      settings,
    })
  })

  it('drops stale responses and applies the latest version', () => {
    const { result } = renderHook(() => useSolveWorker(settings))
    const worker = MockWorker.instances[0]
    if (worker === undefined) throw new Error('worker was not created')

    act(() => {
      result.current.requestSolve('3 + 4')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    act(() => {
      result.current.requestSolve('3 + 5')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    act(() => {
      worker.emit({ version: 1, annotations: [annotation] })
    })
    expect(result.current.annotations).toEqual([])

    act(() => {
      worker.emit({ version: 2, annotations: [annotation] })
    })
    expect(result.current.annotations).toEqual([annotation])
  })

  it('re-solves with new settings and terminates the worker on unmount', () => {
    const { result, rerender, unmount } = renderHook(({ current }) => useSolveWorker(current), {
      initialProps: { current: settings },
    })
    const worker = MockWorker.instances[0]
    if (worker === undefined) throw new Error('worker was not created')

    act(() => {
      result.current.requestSolve('x')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(worker.postMessage).toHaveBeenCalledTimes(1)

    const next: SolveSettings = { ...settings, precision: 8 }
    rerender({ current: next })
    expect(worker.postMessage).toHaveBeenCalledTimes(2)
    expect(worker.postMessage).toHaveBeenLastCalledWith({ version: 2, text: 'x', settings: next })

    unmount()
    expect(worker.terminate).toHaveBeenCalled()
  })
})
