import { expect, test } from "vitest";

import { highlightMath } from "./mathSyntax.ts";

function flatten(text: string): string {
  return highlightMath(text)
    .map((token) => token.text)
    .join("");
}

function highlighted(text: string): { type: string; text: string }[] {
  return highlightMath(text).filter((token) => token.type !== "text");
}

test("tokenizing keeps every character", () => {
  for (const text of ["", "local-first notepad", "2 + 3 = 5", "sin(θ) × 2.5", "🙂 % [x]"]) {
    expect(flatten(text)).toBe(text);
  }
});

test("classifies numbers and operators", () => {
  expect(highlighted("2 + 3 = 5")).toEqual([
    { type: "number", text: "2" },
    { type: "operator", text: "+" },
    { type: "number", text: "3" },
    { type: "operator", text: "=" },
    { type: "number", text: "5" },
  ]);
});

test("classifies a name before a parenthesis as a call", () => {
  expect(highlighted("sin (x) + f(1)").filter((token) => token.type === "call")).toEqual([
    { type: "call", text: "sin" },
    { type: "call", text: "f" },
  ]);
});

test("accepts decimals and typographic operators", () => {
  expect(highlighted(".5 × 2 − 1")).toEqual([
    { type: "number", text: ".5" },
    { type: "operator", text: "×" },
    { type: "number", text: "2" },
    { type: "operator", text: "−" },
    { type: "number", text: "1" },
  ]);
});
