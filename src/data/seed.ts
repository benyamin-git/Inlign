import { db } from './db'
import { createNotebook } from './repositories/notebooks'
import { getSettings, updateSettings } from './repositories/settings'
import { WELCOME_CONTENT, WELCOME_TITLE } from './sampleNotebook'

export async function ensureSeeded(): Promise<void> {
  if ((await getSettings()).seeded) return
  await db.transaction('rw', db.notebooks, db.settings, async () => {
    if ((await getSettings()).seeded) return
    await createNotebook(WELCOME_TITLE, WELCOME_CONTENT)
    await updateSettings({ seeded: true })
  })
}
