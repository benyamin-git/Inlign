import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useIsNarrow } from './media'

interface QueryState {
  matches: boolean
  listeners: Set<(event: MediaQueryListEvent) => void>
}

function fakeMatchMedia(matches: boolean) {
  const state: QueryState = { matches, listeners: new Set() }
  const list = {
    media: '',
    get matches() {
      return state.matches
    },
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      state.listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      state.listeners.delete(listener)
    },
  }
  const spy = vi.spyOn(window, 'matchMedia').mockReturnValue(list as unknown as MediaQueryList)
  return {
    spy,
    state,
    notify(next: boolean) {
      state.matches = next
      for (const listener of state.listeners) listener({ matches: next } as MediaQueryListEvent)
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useIsNarrow', () => {
  it('tracks the default max-width query and updates on change', () => {
    const media = fakeMatchMedia(false)
    const { result, unmount } = renderHook(() => useIsNarrow())
    expect(media.spy).toHaveBeenCalledWith('(max-width: 640px)')
    expect(result.current).toBe(false)

    act(() => {
      media.notify(true)
    })
    expect(result.current).toBe(true)

    unmount()
    expect(media.state.listeners.size).toBe(0)
  })

  it('uses a caller supplied width', () => {
    const media = fakeMatchMedia(true)
    const { result } = renderHook(() => useIsNarrow(900))
    expect(media.spy).toHaveBeenCalledWith('(max-width: 900px)')
    expect(result.current).toBe(true)
  })
})
