import {
  buildBackup,
  fileToNotebook,
  notebookToFile,
  parseBackup,
  restoreBackup,
} from '@/data/backup'
import type { Notebook } from '@/data/models/notebook'
import { createNotebook } from '@/data/repositories/notebooks'
import { en } from '@/i18n/en'
import { translate } from '@/i18n/translate'
import { IS_NATIVE } from '@/lib/platform'

interface FileFilter {
  name: string
  extensions: string[]
}

export async function exportNotebookFile(notebook: Notebook): Promise<void> {
  const { filename, text } = notebookToFile(notebook)
  if (IS_NATIVE) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: filename, filters: [notebookFilter()] })
    if (path === null) return
    await writeTextFile(path, text)
    return
  }
  downloadFile(filename, text, 'text/plain')
}

export async function importNotebookFile(): Promise<Notebook | null> {
  if (IS_NATIVE) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({ multiple: false, directory: false, filters: [notebookFilter()] })
    if (path === null) return null
    const { title, content } = fileToNotebook(baseName(path), await readTextFile(path))
    return createNotebook(title, content)
  }
  const file = await pickFile('.inlign,text/plain')
  if (file === null) return null
  const { title, content } = fileToNotebook(file.name, await file.text())
  return createNotebook(title, content)
}

export async function exportBackupFile(): Promise<void> {
  const backup = await buildBackup()
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `inlign-backup-${stamp}.json`
  const text = JSON.stringify(backup, null, 2)
  if (IS_NATIVE) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: filename, filters: [backupFilter()] })
    if (path === null) return
    await writeTextFile(path, text)
    return
  }
  downloadFile(filename, text, 'application/json')
}

export async function restoreBackupFile(): Promise<boolean> {
  if (IS_NATIVE) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({ multiple: false, directory: false, filters: [backupFilter()] })
    if (path === null) return false
    const envelope = parseBackup(await readTextFile(path))
    await restoreBackup(envelope)
    return true
  }
  const file = await pickFile('.json,application/json')
  if (file === null) return false
  const envelope = parseBackup(await file.text())
  await restoreBackup(envelope)
  return true
}

function notebookFilter(): FileFilter {
  return { name: translate(en, 'settings.filterNotebook'), extensions: ['inlign'] }
}

function backupFilter(): FileFilter {
  return { name: translate(en, 'settings.filterBackup'), extensions: ['json'] }
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
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
