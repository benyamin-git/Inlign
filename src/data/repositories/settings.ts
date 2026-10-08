import { db } from '../db'
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from '../models/settings'

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('app')
  if (stored !== undefined) return stored
  // Double-checked inside the transaction so concurrent first reads cannot race the insert.
  await db.transaction('rw', db.settings, async () => {
    if ((await db.settings.get('app')) === undefined) {
      await db.settings.add(SettingsSchema.parse(DEFAULT_SETTINGS))
    }
  })
  const created = await db.settings.get('app')
  if (created === undefined) throw new Error('settings row missing after creation')
  return created
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const current = await getSettings()
  const next = SettingsSchema.parse({ ...current, ...patch, id: 'app' })
  await db.settings.put(next)
  return next
}
