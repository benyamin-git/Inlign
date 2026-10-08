import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { DEFAULT_SETTINGS, type Settings } from '../models/settings'
import { getSettings, readSettings, updateSettings } from './settings'

beforeEach(async () => {
  await db.notebooks.clear()
  await db.settings.clear()
})

describe('settings repository', () => {
  it('returns and persists the defaults on first read', async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS)
    await expect(db.settings.get('app')).resolves.toEqual(DEFAULT_SETTINGS)
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('resolves concurrent first reads to one row', async () => {
    const [first, second] = await Promise.all([getSettings(), getSettings()])
    expect(first).toEqual(DEFAULT_SETTINGS)
    expect(second).toEqual(DEFAULT_SETTINGS)
    await expect(db.settings.count()).resolves.toBe(1)
  })

  it('merges a patch and persists it', async () => {
    await getSettings()
    const updated = await updateSettings({ precision: 9, theme: 'dark', angleMode: 'degrees' })
    expect(updated).toEqual({
      ...DEFAULT_SETTINGS,
      precision: 9,
      theme: 'dark',
      angleMode: 'degrees',
    })
    await expect(getSettings()).resolves.toEqual(updated)
  })

  it('creates the row on first update', async () => {
    const updated = await updateSettings({ accent: 'teal' })
    expect(updated.accent).toBe('teal')
    await expect(getSettings()).resolves.toEqual(updated)
  })

  it('rejects invalid patches without writing', async () => {
    const before = await getSettings()
    await expect(updateSettings({ precision: 40 })).rejects.toThrow()
    await expect(updateSettings({ toleranceOverride: -1 })).rejects.toThrow()
    await expect(getSettings()).resolves.toEqual(before)
  })

  it('ignores a stray id in the patch', async () => {
    await getSettings()
    const updated = await updateSettings({ id: 'other' } as Partial<Omit<Settings, 'id'>>)
    expect(updated.id).toBe('app')
    await expect(getSettings()).resolves.toEqual(updated)
  })

  it('reads defaults without writing when no row exists', async () => {
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS)
    await expect(db.settings.count()).resolves.toBe(0)
  })

  it('reads the stored row when it exists', async () => {
    await updateSettings({ precision: 9 })
    await expect(readSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, precision: 9 })
  })
})
