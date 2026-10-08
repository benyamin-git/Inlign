import {
  buildBackup,
  fileToNotebook,
  notebookToFile,
  parseBackup,
  restoreBackup,
} from '@/data/backup'
import type { Notebook } from '@/data/models/notebook'
import { createNotebook } from '@/data/repositories/notebooks'

export async function exportNotebookFile(notebook: Notebook): Promise<void> {
  const { filename, text } = notebookToFile(notebook)
  downloadFile(filename, text, 'text/plain')
}

export async function importNotebookFile(): Promise<Notebook | null> {
  const file = await pickFile('.inlign,text/plain')
  if (file === null) return null
  const { title, content } = fileToNotebook(file.name, await file.text())
  return createNotebook(title, content)
}

export async function exportBackupFile(): Promise<void> {
  const backup = await buildBackup()
  const stamp = new Date().toISOString().slice(0, 10)
  downloadFile(`inlign-backup-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json')
}

export async function restoreBackupFile(): Promise<boolean> {
  const file = await pickFile('.json,application/json')
  if (file === null) return false
  const envelope = parseBackup(await file.text())
  await restoreBackup(envelope)
  return true
}

function downloadFile(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
