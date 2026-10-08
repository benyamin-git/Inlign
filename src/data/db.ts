import Dexie, { type EntityTable } from 'dexie'
import type { Notebook } from './models/notebook'
import type { Settings } from './models/settings'

export const db = new Dexie('inlign') as Dexie & {
  notebooks: EntityTable<Notebook, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  notebooks: 'id, updatedAt',
  settings: 'id',
})
