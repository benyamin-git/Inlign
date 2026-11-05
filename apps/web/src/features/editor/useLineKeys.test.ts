import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, test, vi } from "vitest";

import type { Suggestion } from "../../engine/protocol.ts";
import type { LineAction } from "./lineOps.ts";
import { useLineKeys } from "./useLineKeys.ts";

type HarnessProps = {
  onAction: (action: LineAction) => void;
  suggestion?: Suggestion | undefined;
  onAcceptSuggestion?: ((insert: string) => void) | undefined;
};

function Harness({ onAction, suggestion, onAcceptSuggestion }: HarnessProps) {
  const { onKeyDown, onPaste } = useLineKeys({
    index: 0,
    total: 2,
    onAction,
    suggestion,
    onAcceptSuggestion,
  });

  return createElement("textarea", {
    "aria-label": "Line",
    defaultValue: "a =",
    onKeyDown,
    onPaste,
  });
}

function show(props: HarnessProps) {
  render(createElement(Harness, props));
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Line" });
}

afterEach(() => {
  cleanup();
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
