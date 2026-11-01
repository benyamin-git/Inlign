import { afterEach, expect, test } from "vitest";

import { applyTheme, resolveTheme } from "./theme.ts";

afterEach(() => {
  const root = document.documentElement;

  root.removeAttribute("data-theme");
  root.removeAttribute("data-accent");
  root.style.colorScheme = "";
});

test("a stored theme wins over the OS", () => {
  expect(resolveTheme("light", true)).toBe("light");
  expect(resolveTheme("dark", false)).toBe("dark");
  expect(resolveTheme("oled", false)).toBe("oled");
});

test("a null preference follows the OS between Light and Dark", () => {
  expect(resolveTheme(null, true)).toBe("dark");
  expect(resolveTheme(null, false)).toBe("light");
});

test("applyTheme writes the dataset and color-scheme", () => {
  applyTheme("dark", "teal");

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.accent).toBe("teal");
  expect(document.documentElement.style.colorScheme).toBe("dark");

  applyTheme("oled", "violet");

  expect(document.documentElement.dataset.theme).toBe("oled");
  expect(document.documentElement.dataset.accent).toBe("violet");
  expect(document.documentElement.style.colorScheme).toBe("dark");

  applyTheme("light", "blue");

  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.dataset.accent).toBe("blue");
  expect(document.documentElement.style.colorScheme).toBe("light");
});
