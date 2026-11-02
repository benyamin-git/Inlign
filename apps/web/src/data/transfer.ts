import type { Line, Notebook } from "./models.ts";

const MAX_TITLE_LENGTH = 120;
const UNTITLED = "Untitled";

export type ParsedInlign = { title: string; lines: Line[] };

export function serializeInlign(notebook: Pick<Notebook, "lines">): string {
  return notebook.lines.map((line) => line.text).join("\n");
}

export function parseInlign(text: string, fallbackTitle: string): ParsedInlign {
  // CRLF and a lone CR both represent one line break.
  const normalized = text.replace(/\r\n?/g, "\n");
  const title = (fallbackTitle.trim() || UNTITLED).slice(0, MAX_TITLE_LENGTH);

  return {
    title,
    lines: normalized.split("\n").map((lineText) => ({
      id: crypto.randomUUID(),
      text: lineText,
    })),
  };
}

export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
}
