import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { Line, Notebook } from "../../data/models.ts";
import * as notebookRepository from "../../data/notebooks.ts";
import { AUTOSAVE_DELAY_MS, useAutosave } from "./useAutosave.ts";

const notebook: Notebook = {
  id: "notebook-1",
  title: "Test notebook",
  lines: [{ id: "line-1", text: "" }],
  pinned: false,
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1,
};

function lines(text: string): Line[] {
  return [{ id: "line-1", text }];
}

function mockUpdate() {
  return vi.spyOn(notebookRepository, "updateNotebook").mockResolvedValue(notebook);
}

let updateSpy: ReturnType<typeof mockUpdate>;

function expectWrite(text: string): void {
  const call = updateSpy.mock.calls.at(-1);

  expect(call?.[0]).toBe(notebook.id);
  expect(call?.[1].lines).toEqual(lines(text));
  expect(typeof call?.[1].updatedAt).toBe("number");
}

beforeEach(() => {
  vi.useFakeTimers();
  updateSpy = mockUpdate();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("mounting alone writes nothing", () => {
  renderHook(() => useAutosave(notebook.id));

  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 10);
  });

  expect(updateSpy).not.toHaveBeenCalled();
});

test("a burst writes once after 400 ms with the latest lines and a timestamp", () => {
  const { result } = renderHook(() => useAutosave(notebook.id));

  act(() => {
    result.current.schedule(lines("first"));
  });
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 100);
  });
  act(() => {
    result.current.schedule(lines("second"));
  });
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
  });

  expect(updateSpy).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(1);
  });

  expect(updateSpy).toHaveBeenCalledOnce();
  expectWrite("second");

  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
  });

  expect(updateSpy).toHaveBeenCalledOnce();
});

test("flush writes pending text immediately and clears the timer", () => {
  const { result } = renderHook(() => useAutosave(notebook.id));

  act(() => {
    result.current.schedule(lines("pending"));
  });
  act(() => {
    result.current.flush();
  });

  expect(updateSpy).toHaveBeenCalledOnce();
  expectWrite("pending");

  act(() => {
    result.current.flush();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
  });

  expect(updateSpy).toHaveBeenCalledOnce();
});

test("cancel drops pending text without writing", () => {
  const { result } = renderHook(() => useAutosave(notebook.id));

  act(() => {
    result.current.schedule(lines("dropped"));
  });
  act(() => {
    result.current.cancel();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
  });

  expect(updateSpy).not.toHaveBeenCalled();
});

test("window blur flushes pending text", () => {
  const { result } = renderHook(() => useAutosave(notebook.id));

  act(() => {
    result.current.schedule(lines("blurred"));
  });
  act(() => {
    window.dispatchEvent(new Event("blur"));
  });

  expect(updateSpy).toHaveBeenCalledOnce();
  expectWrite("blurred");
});

test("pagehide flushes pending text", () => {
  const { result } = renderHook(() => useAutosave(notebook.id));

  act(() => {
    result.current.schedule(lines("hidden page"));
  });
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });

  expect(updateSpy).toHaveBeenCalledOnce();
});

test("visibilitychange flushes only while the document is hidden", () => {
  const visibility = vi
    .spyOn(Document.prototype, "visibilityState", "get")
    .mockReturnValue("visible");
  const { result } = renderHook(() => useAutosave(notebook.id));

  act(() => {
    result.current.schedule(lines("still visible"));
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(updateSpy).not.toHaveBeenCalled();

  visibility.mockReturnValue("hidden");

  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(updateSpy).toHaveBeenCalledOnce();
  expectWrite("still visible");
});

test("unmounting flushes pending text and removes its listeners", () => {
  const { result, unmount } = renderHook(() => useAutosave(notebook.id));

  act(() => {
    result.current.schedule(lines("last edit"));
  });

  unmount();

  expect(updateSpy).toHaveBeenCalledOnce();

  act(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("pagehide"));
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
  });

  expect(updateSpy).toHaveBeenCalledOnce();
});
