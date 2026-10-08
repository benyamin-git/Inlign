import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKUP_SCHEMA_VERSION, BackupError, buildBackup } from '@/data/backup'
import { db } from '@/data/db'
import { createNotebook, getNotebook, listNotebooks } from '@/data/repositories/notebooks'
import { getSettings, updateSettings } from '@/data/repositories/settings'
import {
  exportBackupFile,
  exportNotebookFile,
  importNotebookFile,
  restoreBackupFile,
} from './dataActions'

interface DownloadStub {
  blobs: Blob[]
  clicks: ReturnType<typeof vi.spyOn>
}

function stubDownload(): DownloadStub {
  const blobs: Blob[] = []
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob)
      return 'blob:test'
    }),
    configurable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
  const clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  return { blobs, clicks }
}

interface PickerStub {
  pick(file: File | null): void
}

function stubFilePicker(): PickerStub {
  const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined)
  return {
    pick(file) {
      const captured = click.mock.instances.at(-1) as HTMLInputElement | undefined
      if (captured === undefined) throw new Error('no file input was opened')
      if (file === null) {
        captured.dispatchEvent(new Event('cancel'))
        return
      }
      Object.defineProperty(captured, 'files', { value: [file], configurable: true })
      captured.dispatchEvent(new Event('change'))
    },
  }
}

beforeEach(async () => {
  await db.notebooks.clear()
  await db.settings.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exportNotebookFile', () => {
  it('downloads the notebook text as an .inlign file', async () => {
    const { blobs, clicks } = stubDownload()
    const notebook = await createNotebook('Ball drop', 'h = 20')

    await exportNotebookFile(notebook)

    expect(blobs).toHaveLength(1)
    expect(await blobs[0]?.text()).toBe('h = 20')
    const anchor = clicks.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('Ball drop.inlign')
  })
})

describe('importNotebookFile', () => {
  it('creates a notebook titled from the filename', async () => {
    const picker = stubFilePicker()
    const pending = importNotebookFile()

    picker.pick(new File(['x = 1'], 'My notes.inlign', { type: 'text/plain' }))
    const notebook = await pending

    expect(notebook?.title).toBe('My notes')
    expect(notebook?.content).toBe('x = 1')
    expect(notebook === null ? undefined : await getNotebook(notebook.id)).toEqual(notebook)
  })

  it('returns null when the file picker is canceled', async () => {
    const picker = stubFilePicker()
    const pending = importNotebookFile()

    picker.pick(null)

    await expect(pending).resolves.toBeNull()
    expect(await listNotebooks()).toHaveLength(0)
  })
})

describe('exportBackupFile', () => {
  it('downloads a JSON backup envelope', async () => {
    const { blobs, clicks } = stubDownload()
    await createNotebook('First', 'x = 1')

    await exportBackupFile()

    const parsed = JSON.parse((await blobs[0]?.text()) ?? '') as {
      schemaVersion: number
      notebooks: unknown[]
    }
    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(parsed.notebooks).toHaveLength(1)
    const anchor = clicks.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toMatch(/^inlign-backup-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe('restoreBackupFile', () => {
  it('replaces the database with the backup contents', async () => {
    await createNotebook('Old', 'old = 1')
    await updateSettings({ precision: 9 })
    const backup = await buildBackup()
    await db.notebooks.clear()
    await db.settings.clear()

    const picker = stubFilePicker()
    const pending = restoreBackupFile()
    picker.pick(new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }))

    await expect(pending).resolves.toBe(true)
    expect((await listNotebooks()).map((notebook) => notebook.title)).toEqual(['Old'])
    expect((await getSettings()).precision).toBe(9)
  })

  it('rejects a file that does not parse as a backup', async () => {
    const picker = stubFilePicker()
    const pending = restoreBackupFile()

    picker.pick(new File(['not json'], 'backup.json', { type: 'application/json' }))

    await expect(pending).rejects.toBeInstanceOf(BackupError)
  })

  it('returns false when the file picker is canceled', async () => {
    const picker = stubFilePicker()
    const pending = restoreBackupFile()

    picker.pick(null)

    await expect(pending).resolves.toBe(false)
  })
})
