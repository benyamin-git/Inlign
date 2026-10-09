import { newId } from '@/lib/id'
import { db } from '../db'
import { NotebookSchema, type Notebook } from '../models/notebook'

const DEFAULT_TITLE = 'Untitled'

export async function listNotebooks(): Promise<Notebook[]> {
  return db.notebooks.orderBy('updatedAt').reverse().toArray()
}

export async function createNotebook(title = DEFAULT_TITLE, content = ''): Promise<Notebook> {
  const now = Date.now()
  const notebook: Notebook = {
    id: newId(),
    title,
    content,
    createdAt: now,
    updatedAt: now,
  }
  await db.notebooks.add(NotebookSchema.parse(notebook))
  return notebook
}

export async function getNotebook(id: string): Promise<Notebook | undefined> {
  return db.notebooks.get(id)
}

export async function renameNotebook(id: string, title: string): Promise<void> {
  await updateNotebook(id, { title })
}

export async function updateContent(id: string, content: string): Promise<void> {
  await updateNotebook(id, { content })
}

export async function deleteNotebook(id: string): Promise<void> {
  await db.notebooks.delete(id)
}

async function updateNotebook(
  id: string,
  patch: Partial<Pick<Notebook, 'title' | 'content'>>,
): Promise<void> {
  const existing = await db.notebooks.get(id)
  if (existing === undefined) return
  const next = NotebookSchema.parse({ ...existing, ...patch, updatedAt: Date.now() })
  await db.notebooks.put(next)
}
