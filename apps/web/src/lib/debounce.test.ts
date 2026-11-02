import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { debounce } from "./debounce.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("keeps only the latest arguments and fires once after the delay", () => {
  const callback = vi.fn<(value: string) => void>();
  const debounced = debounce(callback, 400);

  debounced("first");
  vi.advanceTimersByTime(300);
  debounced("second");
  vi.advanceTimersByTime(399);

  expect(callback).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);

  expect(callback).toHaveBeenCalledOnce();
  expect(callback).toHaveBeenCalledWith("second");

  vi.advanceTimersByTime(1_000);

  expect(callback).toHaveBeenCalledOnce();
});

test("flush writes pending work once and clears the timer", () => {
  const callback = vi.fn<(value: string) => void>();
  const debounced = debounce(callback, 400);

  debounced("pending");
  debounced.flush();

  expect(callback).toHaveBeenCalledOnce();
  expect(callback).toHaveBeenCalledWith("pending");

  debounced.flush();
  vi.advanceTimersByTime(1_000);

  expect(callback).toHaveBeenCalledOnce();
});

test("cancel drops pending work without writing", () => {
  const callback = vi.fn<(value: string) => void>();
  const debounced = debounce(callback, 400);

  debounced("dropped");
  debounced.cancel();
  vi.advanceTimersByTime(1_000);

  expect(callback).not.toHaveBeenCalled();
});
