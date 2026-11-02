import { expect, test } from "vitest";

import type { Notebook } from "./models.ts";
import { parseInlign, serializeInlign, slugify } from "./transfer.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function notebookWith(texts: string[]): Pick<Notebook, "lines"> {
  return {
    lines: texts.map((text) => ({ id: crypto.randomUUID(), text })),
  };
}

test("serializes lines joined with newlines and no trailing newline", () => {
  expect(serializeInlign(notebookWith(["first", "second", "third"]))).toBe("first\nsecond\nthird");
  expect(serializeInlign(notebookWith(["only"]))).toBe("only");
  expect(serializeInlign(notebookWith([""]))).toBe("");
});

test("round-trips text through serialization and parsing", () => {
  const original = ["first line", "", "third line"];
  const parsed = parseInlign(serializeInlign(notebookWith(original)), "From file");

  expect(parsed.title).toBe("From file");
  expect(parsed.lines.map((line) => line.text)).toEqual(original);
  expect(parsed.lines.every((line) => UUID.test(line.id))).toBe(true);
  expect(new Set(parsed.lines.map((line) => line.id)).size).toBe(original.length);
});

test("normalizes CRLF and lone CR line endings", () => {
  const parsed = parseInlign("one\r\ntwo\rthree\r\nfour", "mixed");

  expect(parsed.lines.map((line) => line.text)).toEqual(["one", "two", "three", "four"]);
});

test("an empty file produces exactly one empty line", () => {
  const lines = parseInlign("", "empty").lines;

  expect(lines).toHaveLength(1);
  expect(lines[0]?.text).toBe("");
  expect(lines[0]?.id).toMatch(UUID);
});

test("takes the title from the filename fallback and caps it at 120 characters", () => {
  expect(parseInlign("x", "  Draft  ").title).toBe("Draft");
  expect(parseInlign("x", "").title).toBe("Untitled");
  expect(parseInlign("x", "   ").title).toBe("Untitled");
  expect(parseInlign("x", "y".repeat(130)).title).toBe("y".repeat(120));
  expect(parseInlign("x", `  ${"z".repeat(130)}  `).title).toBe("z".repeat(120));
});

test("slugifies titles into safe filename stems", () => {
  expect(slugify("  Draft  ")).toBe("draft");
  expect(slugify("Café déjà vu!")).toBe("cafe-deja-vu");
  expect(slugify("a/b_c 42")).toBe("a-b-c-42");
  expect(slugify("---")).toBe("untitled");
  expect(slugify("")).toBe("untitled");
});
