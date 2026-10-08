import { beforeEach, describe, expect, it } from 'vitest'
import {
  BACKUP_SCHEMA_VERSION,
  BackupError,
  buildBackup,
  fileToNotebook,
  notebookToFile,
  parseBackup,
  restoreBackup,
} from './backup'
import { db } from './db'
import type { Notebook } from './models/notebook'
import { DEFAULT_SETTINGS } from './models/settings'
import { createNotebook, listNotebooks } from './repositories/notebooks'
import { getSettings, updateSettings } from './repositories/settings'

const fileNotebook: Notebook = {
  id: 'n1',
  title: 'Ball drop',
  content: 'h = 20\ng = 9.81',
  createdAt: 1000,
  updatedAt: 2000,
}

beforeEach(async () => {
  await db.notebooks.clear()
  await db.settings.clear()
})

describe('buildBackup', () => {
  it('captures notebooks and settings in a versioned envelope', async () => {
    await createNotebook('First', 'x = 1')
    await updateSettings({ precision: 10 })

    const backup = await buildBackup()
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false)
    expect(backup.notebooks.map((notebook) => notebook.title)).toEqual(['First'])
    expect(backup.settings).toEqual({ ...DEFAULT_SETTINGS, precision: 10 })
  })
})

describe('parseBackup', () => {
  it('round-trips a built backup through JSON', async () => {
    await createNotebook('First', 'x = 1')
    const backup = await buildBackup()
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)
  })

  it('throws BackupError for invalid JSON', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError)
    expect(() => parseBackup('')).toThrow(BackupError)
  })

  it('throws BackupError for a wrong schema version', async () => {
    const backup = await buildBackup()
    expect(() => parseBackup(JSON.stringify({ ...backup, schemaVersion: 2 }))).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ ...backup, schemaVersion: '1' }))).toThrow(
      BackupError,
    )
  })

  it('throws BackupError for wrong field types', async () => {
    const backup = await buildBackup()
    expect(() => parseBackup(JSON.stringify({ ...backup, exportedAt: 5 }))).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ ...backup, notebooks: [{ id: 'x' }] }))).toThrow(
      BackupError,
    )
    expect(() =>
      parseBackup(
        JSON.stringify({ ...backup, settings: { ...backup.settings, precision: 'high' } }),
      ),
    ).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify(null))).toThrow(BackupError)
  })
})

describe('restoreBackup', () => {
  it('replaces existing notebooks and settings', async () => {
    await createNotebook('Keep', 'a = 1')
    await updateSettings({ precision: 9 })
    const backup = await buildBackup()

    await createNotebook('Extra', 'b = 2')
    await updateSettings({ precision: 15 })

    await restoreBackup(backup)
    expect((await listNotebooks()).map((notebook) => notebook.title)).toEqual(['Keep'])
    expect((await getSettings()).precision).toBe(9)
  })

  it('rejects an invalid envelope and leaves data intact', async () => {
    await createNotebook('Keep', 'a = 1')
    const backup = await buildBackup()
    const invalid = { ...backup, settings: { ...DEFAULT_SETTINGS, precision: 99 } }

    await expect(restoreBackup(invalid)).rejects.toThrow(BackupError)
    expect((await listNotebooks()).map((notebook) => notebook.title)).toEqual(['Keep'])
  })

  it('rolls back when the restore write fails', async () => {
    await createNotebook('Keep', 'a = 1')
    const backup = await buildBackup()
    const [notebook] = backup.notebooks
    if (notebook === undefined) throw new Error('expected a notebook in the backup')

    const duplicate = { ...backup, notebooks: [notebook, notebook] }
    await expect(restoreBackup(duplicate)).rejects.toThrow()
    expect((await listNotebooks()).map((item) => item.title)).toEqual(['Keep'])
  })
})

describe('notebookToFile', () => {
  it('writes the raw content to a sanitized .inlign filename', () => {
    expect(notebookToFile(fileNotebook)).toEqual({
      filename: 'Ball drop.inlign',
      text: 'h = 20\ng = 9.81',
    })
  })

  it('replaces illegal filename characters', () => {
    const { filename } = notebookToFile({ ...fileNotebook, title: 'notes: v1/v2?' })
    expect(filename).toBe('notes- v1-v2-.inlign')
    expect(notebookToFile({ ...fileNotebook, title: 'a\u0000b' }).filename).toBe('a-b.inlign')
  })

  it('trims trailing dots and spaces and falls back for empty titles', () => {
    expect(notebookToFile({ ...fileNotebook, title: '  chapter 1.  ' }).filename).toBe(
      'chapter 1.inlign',
    )
    expect(notebookToFile({ ...fileNotebook, title: '   ' }).filename).toBe('untitled.inlign')
  })
})

describe('fileToNotebook', () => {
  it('takes the title from the filename without its extension', () => {
    expect(fileToNotebook('ball-drop.inlign', 'h = 20')).toEqual({
      title: 'ball-drop',
      content: 'h = 20',
    })
    expect(fileToNotebook('My Notes.inlign', '').title).toBe('My Notes')
    expect(fileToNotebook('archive.tar.inlign', '').title).toBe('archive.tar')
  })

  it('handles other extensions and files without one', () => {
    expect(fileToNotebook('report.txt', 'x').title).toBe('report')
    expect(fileToNotebook('noextension', 'x').title).toBe('noextension')
  })

  it('ignores any directory part of the name', () => {
    expect(fileToNotebook('C:\\Users\\me\\physics.inlign', 'x').title).toBe('physics')
  })
})
