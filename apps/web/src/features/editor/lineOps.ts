import type { Line } from "../../data/models.ts";
import { createId } from "../../lib/id.ts";

/**
 * A keyboard or paste intent from a line card. Change and paste carry the text
 * the card should end up with; split and navigation carry a caret offset.
 */
export type LineAction =
  | { type: "change"; text: string }
  | { type: "split"; offset: number; end?: number }
  | { type: "merge-previous" }
  | { type: "merge-next" }
  | { type: "navigate"; direction: -1 | 1; offset?: number }
  | { type: "paste"; offset: number; text: string; end?: number };

export type LineOpResult = {
  lines: Line[];
  focus: { lineId: string; offset: number };
};

function ensureLines(lines: Line[]): Line[] {
  if (lines.length > 0) {
    return lines;
  }

  return [{ id: createId(), text: "" }];
}

function clampOffset(text: string, offset: number): number {
  return Math.max(0, Math.min(offset, text.length));
}

function clampRange(text: string, offset: number, end: number): { start: number; end: number } {
  const first = clampOffset(text, offset);
  const second = clampOffset(text, end);

  return first <= second ? { start: first, end: second } : { start: second, end: first };
}

export function splitLine(
  lines: Line[],
  lineId: string,
  offset: number,
  end = offset,
): LineOpResult {
  const index = lines.findIndex((line) => line.id === lineId);
  const safeLines = ensureLines(lines);
  const line = index >= 0 ? safeLines[index] : undefined;

  if (!line) {
    return { lines: safeLines, focus: { lineId, offset } };
  }

  const range = clampRange(line.text, offset, end);
  const nextLine: Line = { id: createId(), text: line.text.slice(range.end) };
  const nextLines = safeLines.map((current, currentIndex) =>
    currentIndex === index ? { ...current, text: current.text.slice(0, range.start) } : current,
  );

  nextLines.splice(index + 1, 0, nextLine);

  return { lines: nextLines, focus: { lineId: nextLine.id, offset: 0 } };
}

export function mergeWithPrevious(lines: Line[], lineId: string): LineOpResult | null {
  const index = lines.findIndex((line) => line.id === lineId);
  const current = lines[index];
  const previous = lines[index - 1];

  if (index <= 0 || !current || !previous) {
    return null;
  }

  const merged: Line = { id: previous.id, text: previous.text + current.text };
  const nextLines = [...lines.slice(0, index - 1), merged, ...lines.slice(index + 1)];

  return { lines: nextLines, focus: { lineId: previous.id, offset: previous.text.length } };
}

export function mergeWithNext(lines: Line[], lineId: string): LineOpResult | null {
  const index = lines.findIndex((line) => line.id === lineId);
  const current = lines[index];
  const next = lines[index + 1];

  if (index < 0 || !current || !next) {
    return null;
  }

  const merged: Line = { id: current.id, text: current.text + next.text };
  const nextLines = [...lines.slice(0, index), merged, ...lines.slice(index + 2)];

  return { lines: nextLines, focus: { lineId: current.id, offset: current.text.length } };
}

export function insertText(
  lines: Line[],
  lineId: string,
  offset: number,
  text: string,
  end = offset,
): LineOpResult {
  const index = lines.findIndex((line) => line.id === lineId);
  const safeLines = ensureLines(lines);
  const line = index >= 0 ? safeLines[index] : undefined;

  if (!line) {
    return { lines: safeLines, focus: { lineId, offset } };
  }

  const range = clampRange(line.text, offset, end);
  const before = line.text.slice(0, range.start);
  const after = line.text.slice(range.end);
  const segments = text.replace(/\r\n?/g, "\n").split("\n");
  const firstSegment = segments[0] ?? "";
  const lastSegment = segments[segments.length - 1] ?? "";

  if (segments.length === 1) {
    const nextLine: Line = { id: line.id, text: before + firstSegment + after };
    const nextLines = safeLines.map((current, currentIndex) =>
      currentIndex === index ? nextLine : current,
    );

    return {
      lines: nextLines,
      focus: { lineId: nextLine.id, offset: (before + firstSegment).length },
    };
  }

  const added: Line[] = segments.slice(1).map((segment, segmentIndex) => ({
    id: createId(),
    text: segmentIndex === segments.length - 2 ? segment + after : segment,
  }));
  const firstLine: Line = { id: line.id, text: before + firstSegment };
  const nextLines = safeLines.map((current, currentIndex) =>
    currentIndex === index ? firstLine : current,
  );

  nextLines.splice(index + 1, 0, ...added);

  return {
    lines: nextLines,
    focus: { lineId: added[added.length - 1]?.id ?? firstLine.id, offset: lastSegment.length },
  };
}

export function moveLine(lines: Line[], activeId: string, overId: string): Line[] {
  const from = lines.findIndex((line) => line.id === activeId);
  const to = lines.findIndex((line) => line.id === overId);

  if (from < 0 || to < 0 || from === to) {
    return [...lines];
  }

  const nextLines = [...lines];
  const [moved] = nextLines.splice(from, 1);

  if (!moved) {
    return [...lines];
  }

  nextLines.splice(to, 0, moved);

  return nextLines;
}
