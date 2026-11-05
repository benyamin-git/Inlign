import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { Line } from "../../data/models.ts";
import type { LineEvaluation } from "../../engine/protocol.ts";
import {
  ENGINE_DEBOUNCE_MS,
  useEngineEvaluation,
  type EngineEvaluator,
} from "./useEngineEvaluation.ts";

function lines(...texts: string[]): Line[] {
  return texts.map((text, index) => ({ id: `l${index}`, text }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function advance(milliseconds = ENGINE_DEBOUNCE_MS): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("waits for the debounce before evaluating", async () => {
  const evaluate = vi.fn().mockResolvedValue([]);
  const engine: EngineEvaluator = { evaluate };
  const input = lines("x = 1");

  const { result } = renderHook(() => useEngineEvaluation(engine, input));

  expect(evaluate).not.toHaveBeenCalled();

  await advance(ENGINE_DEBOUNCE_MS - 1);
  expect(evaluate).not.toHaveBeenCalled();

  await advance(1);
  expect(evaluate).toHaveBeenCalledTimes(1);
  expect(evaluate).toHaveBeenCalledWith([{ id: "l0", text: "x = 1" }]);
  expect(result.current.size).toBe(0);
});

test("maps evaluations by line id", async () => {
  const results: LineEvaluation[] = [
    { id: "l0", status: "ok" },
    { id: "l1", status: "incomplete", suggestion: { display: "2", insert: "2" } },
  ];
  const evaluate = vi.fn().mockResolvedValue(results);
  const engine: EngineEvaluator = { evaluate };
  const input = lines("x = 1", "x =");

  const { result } = renderHook(() => useEngineEvaluation(engine, input));

  await advance();

  expect(result.current.get("l0")).toEqual({ id: "l0", status: "ok" });
  expect(result.current.get("l1")).toEqual(results[1]);
  expect(result.current.size).toBe(2);
});

test("case-insensitive evaluation lowercases the engine input and re-runs when toggled", async () => {
  const evaluate = vi.fn().mockResolvedValue([]);
  const engine: EngineEvaluator = { evaluate };
  const input = lines("X = 2", "x = X + Y");

  const { rerender } = renderHook(
    ({ ignoreCase }: { ignoreCase: boolean }) => useEngineEvaluation(engine, input, ignoreCase),
    { initialProps: { ignoreCase: false } },
  );

  await advance();
  expect(evaluate).toHaveBeenLastCalledWith([
    { id: "l0", text: "X = 2" },
    { id: "l1", text: "x = X + Y" },
  ]);

  rerender({ ignoreCase: true });
  await advance();
  expect(evaluate).toHaveBeenLastCalledWith([
    { id: "l0", text: "x = 2" },
    { id: "l1", text: "x = x + y" },
  ]);
});

test("ignores a stale response after a newer request", async () => {
  const first = deferred<LineEvaluation[]>();
  const second = deferred<LineEvaluation[]>();
  const evaluate = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const engine: EngineEvaluator = { evaluate };

  const { result, rerender } = renderHook(
    ({ currentLines }: { currentLines: Line[] }) => useEngineEvaluation(engine, currentLines),
    { initialProps: { currentLines: lines("x = 1") } },
  );

  await advance();
  expect(evaluate).toHaveBeenCalledTimes(1);

  rerender({ currentLines: lines("x = 2") });
  await advance();
  expect(evaluate).toHaveBeenCalledTimes(2);

  first.resolve([{ id: "l0", status: "error", error: "stale" }]);
  await act(async () => {
    await first.promise;
  });
  expect(result.current.size).toBe(0);

  second.resolve([{ id: "l0", status: "ok" }]);
  await act(async () => {
    await second.promise;
  });
  expect(result.current.get("l0")).toEqual({ id: "l0", status: "ok" });
});

test("a rejected evaluation clears existing annotations", async () => {
  const evaluate = vi
    .fn()
    .mockResolvedValueOnce([{ id: "l0", status: "ok" }])
    .mockRejectedValueOnce(new Error("engine failed"));
  const engine: EngineEvaluator = { evaluate };

  const { result, rerender } = renderHook(
    ({ currentLines }: { currentLines: Line[] }) => useEngineEvaluation(engine, currentLines),
    { initialProps: { currentLines: lines("x = 1") } },
  );

  await advance();
  expect(result.current.get("l0")).toEqual({ id: "l0", status: "ok" });

  rerender({ currentLines: lines("x = 2") });
  await advance();
  expect(result.current.size).toBe(0);
});

test("a null engine makes no call", async () => {
  const input = lines("x = 1");
  const { result } = renderHook(() => useEngineEvaluation(null, input));

  await advance(ENGINE_DEBOUNCE_MS * 2);

  expect(result.current.size).toBe(0);
});

test("unmounting before the debounce makes no call", async () => {
  const evaluate = vi.fn().mockResolvedValue([]);
  const engine: EngineEvaluator = { evaluate };
  const input = lines("x = 1");
  const { unmount } = renderHook(() => useEngineEvaluation(engine, input));

  unmount();
  await advance(ENGINE_DEBOUNCE_MS * 2);

  expect(evaluate).not.toHaveBeenCalled();
});

test("a lines change restarts the debounce", async () => {
  const evaluate = vi.fn().mockResolvedValue([]);
  const engine: EngineEvaluator = { evaluate };

  const { rerender } = renderHook(
    ({ currentLines }: { currentLines: Line[] }) => useEngineEvaluation(engine, currentLines),
    { initialProps: { currentLines: lines("x = 1") } },
  );

  await advance(ENGINE_DEBOUNCE_MS - 1);
  expect(evaluate).not.toHaveBeenCalled();

  rerender({ currentLines: lines("x = 2") });
  await advance(ENGINE_DEBOUNCE_MS - 1);
  expect(evaluate).not.toHaveBeenCalled();

  await advance(1);
  expect(evaluate).toHaveBeenCalledTimes(1);
  expect(evaluate).toHaveBeenCalledWith([{ id: "l0", text: "x = 2" }]);
});
