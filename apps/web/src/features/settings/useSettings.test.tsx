import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { db } from "../../data/db.ts";
import * as settingsData from "../../data/settings.ts";
import { useSettings } from "./useSettings.ts";

vi.mock("../../data/settings.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof settingsData>();

  return { ...actual, setSetting: vi.fn(actual.setSetting) };
});

const setSettingMock = vi.mocked(settingsData.setSetting);

beforeEach(async () => {
  await db.delete();
  await db.open();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

test("resolves false and keeps the optimistic value when persistence fails", async () => {
  const { result } = renderHook(() => useSettings());

  await waitFor(() => {
    expect(result.current.accent).toBe("blue");
  });

  setSettingMock.mockRejectedValue(new Error("IndexedDB unavailable"));

  let themeSaved = true;
  let accentSaved = true;
  let caseSaved = true;

  await act(async () => {
    themeSaved = await result.current.setTheme("dark");
    accentSaved = await result.current.setAccent("rose");
    caseSaved = await result.current.setDefaultIgnoreCase(true);
  });

  expect(themeSaved).toBe(false);
  expect(accentSaved).toBe(false);
  expect(caseSaved).toBe(false);
  expect(result.current.theme).toBe("dark");
  expect(result.current.accent).toBe("rose");
  expect(result.current.defaultIgnoreCase).toBe(true);
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.accent).toBe("rose");
  expect(window.localStorage.getItem("inlign.theme")).toBe("dark");
});
