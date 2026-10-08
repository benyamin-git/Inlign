import { z } from 'zod'
import { db } from './db'
import { NotebookSchema, type Notebook } from './models/notebook'
import { SettingsSchema, type Settings } from './models/settings'
import { listNotebooks } from './repositories/notebooks'
import { getSettings } from './repositories/settings'

export const BACKUP_SCHEMA_VERSION = 1

export interface BackupEnvelope {
  schemaVersion: 1
  exportedAt: string
  notebooks: Notebook[]
  settings: Settings
}

export class BackupError extends Error {}

const BackupEnvelopeSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string().min(1),
  notebooks: z.array(NotebookSchema),
  settings: SettingsSchema,
})

export async function buildBackup(): Promise<BackupEnvelope> {
  const [notebooks, settings] = await Promise.all([listNotebooks(), getSettings()])
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    notebooks,
    settings,
  }
}

export function parseBackup(json: string): BackupEnvelope {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new BackupError('Backup file is not valid JSON')
  }
  return validateEnvelope(raw)
}

export async function restoreBackup(envelope: BackupEnvelope): Promise<void> {
  const backup = validateEnvelope(envelope)
  await db.transaction('rw', db.notebooks, db.settings, async () => {
    await db.notebooks.clear()
    await db.settings.clear()
    await db.notebooks.bulkAdd(backup.notebooks)
    await db.settings.add(backup.settings)
  })
}

export function notebookToFile(notebook: Notebook): { filename: string; text: string } {
  return { filename: `${sanitizeFilename(notebook.title)}.inlign`, text: notebook.content }
}

export function fileToNotebook(filename: string, text: string): { title: string; content: string } {
  const base = filename.split(/[\\/]/).pop() ?? filename
  const dot = base.lastIndexOf('.')
  return { title: dot > 0 ? base.slice(0, dot) : base, content: text }
}

function validateEnvelope(value: unknown): BackupEnvelope {
  const result = BackupEnvelopeSchema.safeParse(value)
  if (!result.success) {
    throw new BackupError(`Backup file does not match schema version ${BACKUP_SCHEMA_VERSION}`)
  }
  return result.data
}

const ILLEGAL_FILENAME_CHARS = new Set('<>:"/\\|?*')

function sanitizeFilename(title: string): string {
  const cleaned = Array.from(title.trim(), (char) => {
    const code = char.charCodeAt(0)
    return code < 32 || ILLEGAL_FILENAME_CHARS.has(char) ? '-' : char
  })
    .join('')
    .replace(/[. ]+$/, '')
  return cleaned.length > 0 ? cleaned : 'untitled'
}
