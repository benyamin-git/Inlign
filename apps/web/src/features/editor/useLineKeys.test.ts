import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, useEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";

import type { Suggestion } from "../../engine/protocol.ts";
import type { LineAction } from "./lineOps.ts";
import { DOUBLE_SPACE_MS, useLineKeys } from "./useLineKeys.ts";

type HarnessProps = {
  onAction: (action: LineAction) => void;
  suggestion?: Suggestion | undefined;
  onAcceptSuggestion?: ((insert: string) => void) | undefined;
};

// jsdom does not dispatch beforeinput, so the tests call the same handler
// directly. Playwright covers the native listener wiring.
let beforeInput: ((event: InputEvent) => void) | undefined;

function Harness({ onAction, suggestion, onAcceptSuggestion }: HarnessProps) {
  const handlers = useLineKeys({
    index: 0,
    total: 2,
    onAction,
    suggestion,
    onAcceptSuggestion,
  });

  useEffect(() => {
    beforeInput = handlers.onBeforeInput;
  });

  return createElement("textarea", {
    "aria-label": "Line",
    defaultValue: "a =",
    onKeyDown: handlers.onKeyDown,
    onPaste: handlers.onPaste,
  });
}

function show(props: HarnessProps) {
  render(createElement(Harness, props));
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Line" });
}

function fireInput(data: string): boolean {
  let prevented = false;

  beforeInput?.({
    data,
    inputType: "insertText",
    preventDefault: () => {
      prevented = true;
    },
  } as InputEvent);

  return !prevented;
}

function fireSpace(): boolean {
  return fireInput(" ");
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("pressing Space twice accepts a suggestion and prevents the second space", () => {
  vi.useFakeTimers();
  const onAccept = vi.fn();
  show({
    onAction: vi.fn(),
    suggestion: { display: "5", insert: "5" },
    onAcceptSuggestion: onAccept,
  });

  expect(fireSpace()).toBe(true);
  expect(onAccept).not.toHaveBeenCalled();
  const notPrevented = fireSpace();

  expect(notPrevented).toBe(false);
  expect(onAccept).toHaveBeenCalledTimes(1);
  expect(onAccept).toHaveBeenCalledWith("5");
});

test("Space twice without a suggestion stays two ordinary spaces", () => {
  const onAccept = vi.fn();
  show({ onAction: vi.fn(), onAcceptSuggestion: onAccept });

  expect(fireSpace()).toBe(true);
  expect(fireSpace()).toBe(true);
  expect(onAccept).not.toHaveBeenCalled();
});

test("a slow second Space is not a Tab shortcut", () => {
  vi.useFakeTimers();
  const onAccept = vi.fn();
  show({
    onAction: vi.fn(),
    suggestion: { display: "5", insert: "5" },
    onAcceptSuggestion: onAccept,
  });

  fireSpace();
  vi.advanceTimersByTime(DOUBLE_SPACE_MS + 1);
  const notPrevented = fireSpace();

  expect(notPrevented).toBe(true);
  expect(onAccept).not.toHaveBeenCalled();
});

test("another key between two spaces cancels the double-space shortcut", () => {
  vi.useFakeTimers();
  const onAccept = vi.fn();
  show({
    onAction: vi.fn(),
    suggestion: { display: "5", insert: "5" },
    onAcceptSuggestion: onAccept,
  });

  fireSpace();
  fireInput("x");
  const notPrevented = fireSpace();

  expect(notPrevented).toBe(true);
  expect(onAccept).not.toHaveBeenCalled();
});

test("a soft keyboard reporting Unidentified still accepts two spaces", () => {
  vi.useFakeTimers();
  const onAccept = vi.fn();
  const textarea = show({
    onAction: vi.fn(),
    suggestion: { display: "5", insert: "5" },
    onAcceptSuggestion: onAccept,
  });

  fireEvent.keyDown(textarea, { key: "Unidentified", keyCode: 229 });
  fireSpace();
  fireEvent.keyDown(textarea, { key: "Unidentified", keyCode: 229 });
  const notPrevented = fireSpace();

  expect(notPrevented).toBe(false);
  expect(onAccept).toHaveBeenCalledWith("5");
});

test("plain Tab accepts a suggestion and prevents focus navigation", () => {
  const onAccept = vi.fn();
  const textarea = show({
    onAction: vi.fn(),
    suggestion: { display: "5", insert: "5" },
    onAcceptSuggestion: onAccept,
  });

  const notPrevented = fireEvent.keyDown(textarea, { key: "Tab" });

  expect(notPrevented).toBe(false);
  expect(onAccept).toHaveBeenCalledWith("5");
});

test("Tab without a suggestion is left to the browser", () => {
  const onAccept = vi.fn();
  const textarea = show({ onAction: vi.fn(), onAcceptSuggestion: onAccept });

  const notPrevented = fireEvent.keyDown(textarea, { key: "Tab" });

  expect(notPrevented).toBe(true);
  expect(onAccept).not.toHaveBeenCalled();
});

test("Shift+Tab is left to the browser even with a suggestion", () => {
  const onAccept = vi.fn();
  const textarea = show({
    onAction: vi.fn(),
    suggestion: { display: "5", insert: "5" },
    onAcceptSuggestion: onAccept,
  });

  const notPrevented = fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true });

  expect(notPrevented).toBe(true);
  expect(onAccept).not.toHaveBeenCalled();
});

test("Enter still splits the line", () => {
  const onAction = vi.fn();
  const textarea = show({ onAction });
  textarea.setSelectionRange(1, 1);

  const notPrevented = fireEvent.keyDown(textarea, { key: "Enter" });

  expect(notPrevented).toBe(false);
  expect(onAction).toHaveBeenCalledWith({ type: "split", offset: 1, end: 1 });
});

test("single-line paste remains native and multiline paste still routes", () => {
  const onAction = vi.fn();
  const textarea = show({ onAction });
  textarea.setSelectionRange(1, 2);

  const singleLine = fireEvent.paste(textarea, {
    clipboardData: { getData: () => "plain" },
  });
  expect(singleLine).toBe(true);
  expect(onAction).not.toHaveBeenCalled();

  const multiline = fireEvent.paste(textarea, {
    clipboardData: { getData: () => "X\r\nY" },
  });
  expect(multiline).toBe(false);
  expect(onAction).toHaveBeenCalledWith({
    type: "paste",
    offset: 1,
    text: "X\r\nY",
    end: 2,
  });
});
