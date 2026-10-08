import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKUP_SCHEMA_VERSION, BackupError, buildBackup } from '@/data/backup'
import { db } from '@/data/db'
import { createNotebook, getNotebook, listNotebooks } from '@/data/repositories/notebooks'
import { getSettings, updateSettings } from '@/data/repositories/settings'
import { en } from '@/i18n/en'

const dialog = vi.hoisted(() => ({ open: vi.fn(), save: vi.fn() }))
const fs = vi.hoisted(() => ({ readTextFile: vi.fn(), writeTextFile: vi.fn() }))

vi.mock('@/lib/platform', () => ({ IS_NATIVE: true }))
vi.mock('@tauri-apps/plugin-dialog', () => dialog)
vi.mock('@tauri-apps/plugin-fs', () => fs)

import {
  exportBackupFile,
  exportNotebookFile,
  importNotebookFile,
  restoreBackupFile,
} from './dataActions'

const NOTEBOOK_FILTER = { name: en.settings.filterNotebook, extensions: ['inlign'] }
const BACKUP_FILTER = { name: en.settings.filterBackup, extensions: ['json'] }

beforeEach(async () => {
  await db.notebooks.clear()
  await db.settings.clear()
  dialog.open.mockReset()
  dialog.save.mockReset()
  fs.readTextFile.mockReset()
  fs.writeTextFile.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('native exportNotebookFile', () => {
  it('writes the notebook through the native save dialog', async () => {
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    dialog.save.mockResolvedValue('/home/me/Ball drop.inlign')
    const notebook = await createNotebook('Ball drop', 'h = 20')

    await exportNotebookFile(notebook)

    expect(dialog.save).toHaveBeenCalledWith({
      defaultPath: 'Ball drop.inlign',
      filters: [NOTEBOOK_FILTER],
    })
    expect(fs.writeTextFile).toHaveBeenCalledWith('/home/me/Ball drop.inlign', 'h = 20')
    expect(clicks).not.toHaveBeenCalled()
  })

  it('writes nothing when the save dialog is canceled', async () => {
    dialog.save.mockResolvedValue(null)

    await exportNotebookFile(await createNotebook('Cancelled', 'x = 1'))

    expect(fs.writeTextFile).not.toHaveBeenCalled()
  })
})

describe('native importNotebookFile', () => {
  it('imports a notebook chosen through the native open dialog', async () => {
    const fileInputs = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined)
    dialog.open.mockResolvedValue('C:\\Users\\me\\My notes.inlign')
    fs.readTextFile.mockResolvedValue('x = 1')

    const notebook = await importNotebookFile()

    expect(dialog.open).toHaveBeenCalledWith({
      multiple: false,
      directory: false,
      filters: [NOTEBOOK_FILTER],
    })
    expect(notebook?.title).toBe('My notes')
    expect(notebook?.content).toBe('x = 1')
    expect(notebook === null ? undefined : await getNotebook(notebook.id)).toEqual(notebook)
    expect(fileInputs).not.toHaveBeenCalled()
  })

  it('returns null when the open dialog is canceled', async () => {
    dialog.open.mockResolvedValue(null)

    await expect(importNotebookFile()).resolves.toBeNull()
    expect(fs.readTextFile).not.toHaveBeenCalled()
  })
})

describe('native exportBackupFile', () => {
  it('writes the backup envelope through the native save dialog', async () => {
    dialog.save.mockResolvedValue('/home/me/inlign-backup-2026-10-08.json')
    await createNotebook('First', 'x = 1')

    await exportBackupFile()

    const options = dialog.save.mock.calls.at(0)?.[0] as
      { defaultPath?: string; filters?: unknown } | undefined
    expect(options?.defaultPath).toMatch(/^inlign-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect(options?.filters).toEqual([BACKUP_FILTER])
    const call = fs.writeTextFile.mock.calls.at(0)
    expect(call?.[0]).toBe('/home/me/inlign-backup-2026-10-08.json')
    const parsed = JSON.parse((call?.[1] ?? '') as string) as {
      schemaVersion: number
      notebooks: unknown[]
    }
    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(parsed.notebooks).toHaveLength(1)
  })
})

describe('native restoreBackupFile', () => {
  it('restores the database from a native backup file', async () => {
    await createNotebook('Old', 'old = 1')
    await updateSettings({ precision: 9 })
    const backup = await buildBackup()
    await db.notebooks.clear()
    await db.settings.clear()
    dialog.open.mockResolvedValue('/home/me/backup.json')
    fs.readTextFile.mockResolvedValue(JSON.stringify(backup))

    await expect(restoreBackupFile()).resolves.toBe(true)

    expect(dialog.open).toHaveBeenCalledWith({
      multiple: false,
      directory: false,
      filters: [BACKUP_FILTER],
    })
    expect((await listNotebooks()).map((notebook) => notebook.title)).toEqual(['Old'])
    expect((await getSettings()).precision).toBe(9)
  })

  it('rejects a native file that does not parse as a backup', async () => {
    dialog.open.mockResolvedValue('/home/me/backup.json')
    fs.readTextFile.mockResolvedValue('not json')

    await expect(restoreBackupFile()).rejects.toBeInstanceOf(BackupError)
  })

  it('returns false when the restore dialog is canceled', async () => {
    dialog.open.mockResolvedValue(null)

    await expect(restoreBackupFile()).resolves.toBe(false)
  })
})
