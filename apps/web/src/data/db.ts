import Dexie, { type EntityTable } from "dexie";

import type { Notebook, Settings } from "./models.ts";

// IndexedDB cannot index booleans, so `pinned` is stored as 0 or 1 and mapped
// back to a boolean at the repository boundary.
export type NotebookRecord = Omit<Notebook, "pinned"> & { pinned: 0 | 1 };

export type SettingRecord = {
  key: keyof Settings;
  value: Settings[keyof Settings];
};

export class InlignDB extends Dexie {
  notebooks!: EntityTable<NotebookRecord, "id">;
  settings!: EntityTable<SettingRecord, "key">;

  constructor() {
    super("inlign");

    this.version(1).stores({
      notebooks: "id, pinned, sortOrder, updatedAt",
      settings: "key",
    });
  }
}

export const db = new InlignDB();
