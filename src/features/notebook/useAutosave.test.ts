/// <reference types="node" />
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/data/db'
import { createNotebook, getNotebook } from '@/data/repositories/notebooks'
import { AUTOSAVE_DEBOUNCE_MS, useAutosave } from './useAutosave'

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
}

interface Props {
  id: string | null
  content: string
}

function renderAutosave(initialProps: Props) {
  return renderHook(({ id, content }: Props) => useAutosave(id, content), { initialProps })
}

beforeEach(async () => {
  await db.notebooks.clear()
  await db.settings.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useAutosave', () => {
  it('debounces writes, keeps the latest content and reports the saved state', async () => {
    const notebook = await createNotebook('Notes', '')
    const { result, rerender } = renderAutosave({ id: notebook.id, content: '' })

    rerender({ id: notebook.id, content: 'x = 1' })
    rerender({ id: notebook.id, content: 'x = 2' })
    expect(result.current.saving).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 1)
    })
    expect((await getNotebook(notebook.id))?.content).toBe('')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await act(async () => {
      await settle()
    })

    expect((await getNotebook(notebook.id))?.content).toBe('x = 2')
    expect(result.current.saving).toBe(false)
    expect(result.current.savedAt).not.toBeNull()
  })

  it('skips writes when the content already matches the stored notebook', async () => {
    const notebook = await createNotebook('Notes', 'x = 1')
    renderAutosave({ id: notebook.id, content: 'x = 1' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS)
    })
    await act(async () => {
      await settle()
    })

    expect((await getNotebook(notebook.id))?.updatedAt).toBe(notebook.updatedAt)
  })

  it('flushes pending content when the window loses focus', async () => {
    const notebook = await createNotebook('Notes', '')
    const { rerender } = renderAutosave({ id: notebook.id, content: '' })

    rerender({ id: notebook.id, content: 'blurred' })
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    await act(async () => {
      await settle()
    })

    expect((await getNotebook(notebook.id))?.content).toBe('blurred')
  })

  it('flushes pending content on unmount', async () => {
    const notebook = await createNotebook('Notes', '')
    const { rerender, unmount } = renderAutosave({ id: notebook.id, content: '' })

    rerender({ id: notebook.id, content: 'goodbye' })
    act(() => {
      unmount()
    })
    await act(async () => {
      await settle()
    })

    expect((await getNotebook(notebook.id))?.content).toBe('goodbye')
  })

  it('flushes the previous notebook when switching to another one', async () => {
    const first = await createNotebook('First', 'a = 1')
    const second = await createNotebook('Second', 'b = 1')
    const { rerender } = renderAutosave({ id: first.id, content: 'a = 1' })

    rerender({ id: first.id, content: 'a = 2' })
    rerender({ id: second.id, content: 'b = 1' })
    await act(async () => {
      await settle()
    })

    expect((await getNotebook(first.id))?.content).toBe('a = 2')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS)
    })
    await act(async () => {
      await settle()
    })
    expect((await getNotebook(second.id))?.updatedAt).toBe(second.updatedAt)
  })

  it('stays idle while no notebook is selected', async () => {
    const { result } = renderAutosave({ id: null, content: 'x = 1' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS)
    })

    expect(result.current.saving).toBe(false)
    expect(result.current.savedAt).toBeNull()
  })
})
