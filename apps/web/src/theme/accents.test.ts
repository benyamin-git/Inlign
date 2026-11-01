import { expect, test } from "vitest";

// Vite's ?raw import keeps the test inside the app tsconfig, which has no
// Node types, and reads the committed generated file rather than a glob.
import accentsCss from "./accents.css?raw";

const ACCENTS = [
  { name: "blue", light: "#35639c", dark: "#7daeec" },
  { name: "teal", light: "#127070", dark: "#69bbba" },
  { name: "green", light: "#3c703f", dark: "#4bc957" },
  { name: "orange", light: "#924c2b", dark: "#e29572" },
  { name: "rose", light: "#94464e", dark: "#e58f95" },
  { name: "violet", light: "#7638c0", dark: "#b49ce1" },
] as const;

function block(theme: string, accent: string): string {
  const match = accentsCss.match(
    new RegExp(`\\[data-theme="${theme}"\\]\\[data-accent="${accent}"\\] \\{([^}]*)\\}`),
  );

  expect(match).not.toBeNull();

  return match?.[1] ?? "";
}

function primary(theme: string, accent: string): string {
  const match = block(theme, accent).match(/--primary: (#[0-9a-f]{6});/);

  expect(match).not.toBeNull();

  return match?.[1] ?? "";
}

test("writes one block per theme and accent", () => {
  const blocks = accentsCss.match(/^\[data-theme="[a-z]+"\]\[data-accent="[a-z]+"\] \{$/gm);

  expect(blocks).toHaveLength(18);
});

test("matches the documented light and dark primaries", () => {
  for (const accent of ACCENTS) {
    expect(primary("light", accent.name)).toBe(accent.light);
    expect(primary("dark", accent.name)).toBe(accent.dark);
    expect(primary("oled", accent.name)).toBe(accent.dark);
  }
});
