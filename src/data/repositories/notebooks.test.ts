import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import {
  createNotebook,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  renameNotebook,
  updateContent,
} from './notebooks'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let now = 1000

beforeEach(async () => {
  now = 1000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  await db.notebooks.clear()
  await db.settings.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('notebooks repository', () => {
  it('starts empty', async () => {
    await expect(listNotebooks()).resolves.toEqual([])
  })

  it('creates a notebook with defaults and persists it', async () => {
    const notebook = await createNotebook()
    expect(notebook.id).toMatch(UUID_PATTERN)
    expect(notebook.title).toBe('Untitled')
    expect(notebook.content).toBe('')
    expect(notebook.createdAt).toBe(1000)
    expect(notebook.updatedAt).toBe(1000)
    await expect(getNotebook(notebook.id)).resolves.toEqual(notebook)
  })

  it('creates a notebook with a title and content', async () => {
    const notebook = await createNotebook('Ball drop', 'h = 20\ng = 9.81')
    expect(notebook.title).toBe('Ball drop')
    expect(notebook.content).toBe('h = 20\ng = 9.81')
  })

  it('lists notebooks by last edit, newest first', async () => {
    const first = await createNotebook('First')
    now = 1001
    await createNotebook('Second')
    expect((await listNotebooks()).map((notebook) => notebook.title)).toEqual(['Second', 'First'])

    now = 1002
    await updateContent(first.id, 'x = 1')
    expect((await listNotebooks()).map((notebook) => notebook.title)).toEqual(['First', 'Second'])
  })

  it('renames a notebook without touching its content', async () => {
    const notebook = await createNotebook('Draft', 'a = 1')
    now = 1001
    await renameNotebook(notebook.id, 'Final')
    const stored = await getNotebook(notebook.id)
    expect(stored?.title).toBe('Final')
    expect(stored?.content).toBe('a = 1')
    expect(stored?.updatedAt).toBe(1001)
  })

  it('updates content and refreshes updatedAt', async () => {
    const notebook = await createNotebook('Notes', 'a = 1')
    now = 1001
    await updateContent(notebook.id, 'a = 2')
    const stored = await getNotebook(notebook.id)
    expect(stored?.content).toBe('a = 2')
    expect(stored?.updatedAt).toBe(1001)
  })

  it('deletes a notebook', async () => {
    const notebook = await createNotebook()
    await deleteNotebook(notebook.id)
    await expect(getNotebook(notebook.id)).resolves.toBeUndefined()
  })

  it('ignores updates for a missing notebook', async () => {
    await expect(renameNotebook('missing', 'Nope')).resolves.toBeUndefined()
    await expect(updateContent('missing', 'x')).resolves.toBeUndefined()
    await expect(listNotebooks()).resolves.toEqual([])
  })

  it('rejects invalid writes before persisting', async () => {
    const notebook = await createNotebook('Keep', 'a = 1')
    await expect(updateContent(notebook.id, 42 as unknown as string)).rejects.toThrow()
    await expect(renameNotebook(notebook.id, null as unknown as string)).rejects.toThrow()
    const stored = await getNotebook(notebook.id)
    expect(stored?.title).toBe('Keep')
    expect(stored?.content).toBe('a = 1')
  })
})
