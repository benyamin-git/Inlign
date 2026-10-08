import { describe, expect, it } from 'vitest'
import { db } from './db'
import { NotebookSchema, type Notebook } from './models/notebook'
import { DEFAULT_SETTINGS, SettingsSchema } from './models/settings'

const notebook: Notebook = {
  id: 'n1',
  title: 'Notes',
  content: 'x = 1',
  createdAt: 1000,
  updatedAt: 2000,
}

describe('NotebookSchema', () => {
  it('accepts a well-formed notebook unchanged', () => {
    expect(NotebookSchema.parse(notebook)).toEqual(notebook)
  })

  it('rejects missing fields and wrong types', () => {
    expect(NotebookSchema.safeParse({ ...notebook, id: 1 }).success).toBe(false)
    expect(NotebookSchema.safeParse({ ...notebook, title: null }).success).toBe(false)
    expect(NotebookSchema.safeParse({ ...notebook, createdAt: 'now' }).success).toBe(false)
    expect(NotebookSchema.safeParse({ ...notebook, updatedAt: 1.5 }).success).toBe(false)
  })
})

describe('SettingsSchema', () => {
  it('accepts the defaults unchanged', () => {
    expect(SettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
  })

  it('rejects out-of-range and unknown values', () => {
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, precision: 4 }).success).toBe(false)
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, toleranceOverride: -1 }).success).toBe(
      false,
    )
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, angleMode: 'gradians' }).success).toBe(
      false,
    )
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, theme: 'sepia' }).success).toBe(false)
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, accent: 'cyan' }).success).toBe(false)
  })
})

describe('db', () => {
  it('registers the version 1 stores', () => {
    expect(db.name).toBe('inlign')
    expect(db.tables.map((table) => table.name).sort()).toEqual(['notebooks', 'settings'])
    expect(db.table('notebooks').schema.indexes.map((index) => index.name)).toEqual(['updatedAt'])
  })
})
