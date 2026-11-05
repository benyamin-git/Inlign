import { z } from "zod";

import type { Accent, Notebook, Settings, Theme } from "./models.ts";
import { createId } from "../lib/id.ts";

export const BACKUP_FORMAT = "inlign-backup";
export const BACKUP_VERSION = 1;

const THEMES = ["light", "dark", "oled"] as const satisfies readonly Theme[];
const ACCENTS = [
  "blue",
  "teal",
  "green",
  "orange",
  "rose",
  "violet",
] as const satisfies readonly Accent[];

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  notebooks: Notebook[];
  settings: Settings;
};

const lineSchema = z.object({
  id: z.uuid("Line ids must be UUIDs"),
  text: z.string(),
});

const notebookSchema = z
  .object({
    id: z.uuid("Notebook ids must be UUIDs"),
    title: z
      .string()
      .min(1, "A notebook title cannot be empty")
      .max(120, "A title is at most 120 characters"),
    lines: z.array(lineSchema).min(1, "A notebook must have at least one line"),
    pinned: z.boolean(),
    ignoreCase: z.boolean().default(false),
    sortOrder: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .superRefine((notebook, context) => {
    const lineIds = new Set<string>();

    for (const line of notebook.lines) {
      if (lineIds.has(line.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate line id ${line.id}`,
          path: ["lines"],
        });

        return;
      }

      lineIds.add(line.id);
    }
  });

const settingsSchema = z.object({
  theme: z.enum(THEMES).nullable(),
  accent: z.enum(ACCENTS),
  defaultIgnoreCase: z.boolean().default(false),
});

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.iso.datetime(),
  notebooks: z.array(notebookSchema),
  settings: settingsSchema,
});

/** A rejected backup with a message that is safe to show in the UI. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

function cloneNotebook(notebook: Notebook): Notebook {
  return { ...notebook, lines: notebook.lines.map((line) => ({ ...line })) };
}

export function createBackup(notebooks: Notebook[], settings: Settings): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    notebooks: notebooks.map(cloneNotebook),
    settings: { ...settings },
  };
}

export function parseBackup(input: unknown): Backup {
  const result = backupSchema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue && issue.path.length > 0 ? issue.path.join(".") : "backup";
    const detail = issue?.message ?? "The file does not match the backup format";

    throw new BackupError(`Invalid backup file: ${path}: ${detail}.`);
  }

  return result.data;
}

/**
 * Clones every notebook and line with a new id so an "add" restore cannot
 * collide with the records that already exist.
 */
export function withFreshIds(backup: Backup): Backup {
  return {
    ...backup,
    notebooks: backup.notebooks.map((notebook) => ({
      ...notebook,
      id: createId(),
      lines: notebook.lines.map((line) => ({ id: createId(), text: line.text })),
    })),
  };
}

/**
 * Current notebooks win only when the import has no record with the same id.
 * Matching ids are replaced by the imported record and new ids are appended.
 */
export function mergeBackup(current: Notebook[], imported: Notebook[]): Notebook[] {
  const importedById = new Map(imported.map((notebook) => [notebook.id, notebook]));
  const currentIds = new Set(current.map((notebook) => notebook.id));
  const merged = current.map((notebook) => importedById.get(notebook.id) ?? notebook);

  for (const notebook of imported) {
    if (!currentIds.has(notebook.id)) {
      merged.push(notebook);
    }
  }

  return merged;
}
