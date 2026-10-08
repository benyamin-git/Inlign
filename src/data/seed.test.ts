import { beforeEach, describe, expect, it } from 'vitest'
import { solveDocument } from '@/engine'
import type { SolveSettings } from '@/engine/types'
import { db } from './db'
import { createNotebook, deleteNotebook, listNotebooks } from './repositories/notebooks'
import { getSettings, updateSettings } from './repositories/settings'
import { WELCOME_CONTENT, WELCOME_TITLE } from './sampleNotebook'
import { ensureSeeded } from './seed'

const settings: SolveSettings = { angleMode: 'radians', precision: 12, toleranceOverride: null }

beforeEach(async () => {
  await db.notebooks.clear()
  await db.settings.clear()
})

describe('ensureSeeded', () => {
  it('creates the welcome notebook once and marks settings seeded', async () => {
    await ensureSeeded()
    const notebooks = await listNotebooks()
    expect(notebooks).toHaveLength(1)
    expect(notebooks[0]?.title).toBe(WELCOME_TITLE)
    expect((await getSettings()).seeded).toBe(true)

    await ensureSeeded()
    expect(await listNotebooks()).toHaveLength(1)
  })

  it('seeds once when called concurrently', async () => {
    await Promise.all([ensureSeeded(), ensureSeeded()])
    expect(await listNotebooks()).toHaveLength(1)
    expect((await getSettings()).seeded).toBe(true)
  })

  it('never overwrites existing notebooks or settings', async () => {
    await createNotebook('My notes', 'x = 1')
    await updateSettings({ precision: 9 })

    await ensureSeeded()

    const notebooks = await listNotebooks()
    expect(notebooks).toHaveLength(2)
    expect(
      notebooks.some((notebook) => notebook.title === 'My notes' && notebook.content === 'x = 1'),
    ).toBe(true)
    expect((await getSettings()).precision).toBe(9)
  })

  it('does not recreate the welcome notebook after it is deleted', async () => {
    await ensureSeeded()
    const [welcome] = await listNotebooks()
    if (welcome === undefined) throw new Error('expected the welcome notebook')

    await deleteNotebook(welcome.id)
    await ensureSeeded()
    expect(await listNotebooks()).toHaveLength(0)
  })

  it('does nothing when settings already say seeded', async () => {
    await updateSettings({ seeded: true })
    await ensureSeeded()
    expect(await listNotebooks()).toHaveLength(0)
  })
})

describe('WELCOME_CONTENT', () => {
  it('resolves with exactly the deliberate t = 2.1 conflict', () => {
    const annotations = solveDocument(WELCOME_CONTENT, settings)
    const conflicts = annotations.filter((annotation) => annotation.kind === 'conflict')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.expected).toBe('2.019')
    expect(WELCOME_CONTENT.split('\n')[conflicts[0]?.line ?? -1]?.trim()).toBe('t = 2.1')
    expect(annotations.filter((annotation) => annotation.kind === 'error')).toEqual([])
  })
})
