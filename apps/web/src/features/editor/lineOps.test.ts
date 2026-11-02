import { expect, test } from "vitest";

import type { Line } from "../../data/models.ts";
import { insertText, mergeWithNext, mergeWithPrevious, moveLine, splitLine } from "./lineOps.ts";

function lines(...texts: string[]): Line[] {
  return texts.map((text, index) => ({ id: `line-${String(index + 1)}`, text }));
}

function textOf(collection: Line[]): string[] {
  return collection.map((line) => line.text);
}

test("splits a line at the caret and focuses the new card at its start", () => {
  const result = splitLine(lines("alphabet"), "line-1", 5);

  expect(result.lines).toHaveLength(2);
  expect(result.lines[0]).toMatchObject({ id: "line-1", text: "alpha" });
  expect(result.lines[1]?.text).toBe("bet");
  expect(result.lines[1]?.id).not.toBe("line-1");
  expect(result.focus).toEqual({ lineId: result.lines[1]?.id, offset: 0 });
});

test("splits at the start and at the end, including an empty tail", () => {
  const atStart = splitLine(lines("alpha"), "line-1", 0);

  expect(textOf(atStart.lines)).toEqual(["", "alpha"]);

  const atEnd = splitLine(lines("alpha"), "line-1", 5);

  expect(textOf(atEnd.lines)).toEqual(["alpha", ""]);
});

test("clamps split offsets to the line text", () => {
  expect(textOf(splitLine(lines("abc"), "line-1", -4).lines)).toEqual(["", "abc"]);
  expect(textOf(splitLine(lines("abc"), "line-1", 99).lines)).toEqual(["abc", ""]);
});

test("merges a line into the previous one and focuses the join", () => {
  const result = mergeWithPrevious(lines("alpha", "beta", "gamma"), "line-2");

  expect(result).not.toBeNull();
  expect(textOf(result!.lines)).toEqual(["alphabeta", "gamma"]);
  expect(result?.lines[0]?.id).toBe("line-1");
  expect(result?.focus).toEqual({ lineId: "line-1", offset: 5 });
});

test("cannot merge the first line into a previous card", () => {
  expect(mergeWithPrevious(lines("alpha", "beta"), "line-1")).toBeNull();
  expect(mergeWithPrevious(lines("alpha"), "line-1")).toBeNull();
});

test("merges the next line into the current one and keeps the old end", () => {
  const result = mergeWithNext(lines("alpha", "beta", "gamma"), "line-1");

  expect(result).not.toBeNull();
  expect(textOf(result!.lines)).toEqual(["alphabeta", "gamma"]);
  expect(result?.lines[0]?.id).toBe("line-1");
  expect(result?.focus).toEqual({ lineId: "line-1", offset: 5 });
});

test("cannot merge the last line into a next card", () => {
  expect(mergeWithNext(lines("alpha", "beta"), "line-2")).toBeNull();
  expect(mergeWithNext(lines("alpha"), "line-1")).toBeNull();
});

test("inserts single-line text at the caret without splitting", () => {
  const result = insertText(lines("abcd"), "line-1", 2, "XY");

  expect(result.lines).toHaveLength(1);
  expect(result.lines[0]).toMatchObject({ id: "line-1", text: "abXYcd" });
  expect(result.focus).toEqual({ lineId: "line-1", offset: 4 });
});

test("inserts empty text as a no-op caret move", () => {
  const result = insertText(lines("abcd"), "line-1", 2, "");

  expect(textOf(result.lines)).toEqual(["abcd"]);
  expect(result.lines[0]?.id).toBe("line-1");
  expect(result.focus).toEqual({ lineId: "line-1", offset: 2 });
});

test("pastes CRLF text across cards, keeping the first id and focusing after the last part", () => {
  const result = insertText(lines("ab"), "line-1", 1, "X\r\nY\rZ");

  expect(result.lines).toHaveLength(3);
  expect(result.lines[0]).toMatchObject({ id: "line-1", text: "aX" });
  expect(textOf(result.lines)).toEqual(["aX", "Y", "Zb"]);
  expect(result.lines[1]?.id).not.toBe("line-1");
  expect(result.lines[2]?.id).not.toBe(result.lines[1]?.id);
  expect(result.focus).toEqual({ lineId: result.lines[2]?.id, offset: 1 });
});

test("pastes a trailing newline as a final empty card", () => {
  const result = insertText(lines("abc"), "line-1", 3, "X\n");

  expect(textOf(result.lines)).toEqual(["abcX", ""]);
  expect(result.focus).toEqual({ lineId: result.lines[1]?.id, offset: 0 });
});

test("a single-line notebook can grow with a paste", () => {
  const result = insertText(lines(""), "line-1", 0, "one\ntwo");

  expect(textOf(result.lines)).toEqual(["one", "two"]);
});

test("never returns zero lines", () => {
  expect(splitLine([], "missing", 0).lines).toHaveLength(1);
  expect(insertText([], "missing", 0, "").lines).toHaveLength(1);
});

test("moves a line down and up with array-move semantics", () => {
  const original = lines("a", "b", "c");

  expect(moveLine(original, "line-1", "line-3").map((line) => line.text)).toEqual(["b", "c", "a"]);
  expect(moveLine(original, "line-3", "line-1").map((line) => line.text)).toEqual(["c", "a", "b"]);
});

test("moving onto itself or an unknown id leaves the order unchanged", () => {
  const original = lines("a", "b", "c");

  expect(moveLine(original, "line-1", "line-1").map((line) => line.text)).toEqual(["a", "b", "c"]);
  expect(moveLine(original, "missing", "line-2").map((line) => line.text)).toEqual(["a", "b", "c"]);
  expect(original.map((line) => line.text)).toEqual(["a", "b", "c"]);
});
