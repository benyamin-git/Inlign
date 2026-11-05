import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { LineEvaluation } from "../../engine/protocol.ts";
import { LineCard } from "./LineCard.tsx";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    isDragging: false,
    listeners: {},
    setActivatorNodeRef: () => {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
  }),
}));

function renderCard(text: string, annotation?: LineEvaluation) {
  const onAction = vi.fn();

  render(
    <ol>
      <LineCard
        line={{ id: "l1", text }}
        index={0}
        total={1}
        annotation={annotation}
        onAction={onAction}
      />
    </ol>,
  );

  return {
    card: screen.getByRole("listitem"),
    highlight: document.querySelector("[data-line-highlight]"),
    onAction,
    textarea: screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Line 1" }),
  };
}

function description(textarea: HTMLTextAreaElement): string {
  const id = textarea.getAttribute("aria-describedby");

  if (id === null) {
    return "";
  }

  return document.getElementById(id)?.textContent ?? "";
}

function focusAtEnd(textarea: HTMLTextAreaElement): void {
  fireEvent.focus(textarea);
  const end = textarea.value.length;
  textarea.setSelectionRange(end, end);
  fireEvent.keyUp(textarea, { key: "End" });
}

const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");

function stubExecCommand(implementation: () => boolean) {
  const execCommand = vi.fn(implementation);
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: execCommand,
  });
  return execCommand;
}

afterEach(() => {
  if (execCommandDescriptor === undefined) {
    Reflect.deleteProperty(document, "execCommand");
  } else {
    Object.defineProperty(document, "execCommand", execCommandDescriptor);
  }

  cleanup();
});

test("shows an error with a loss border and accessible description", () => {
  const { card, textarea } = renderCard("a = 6", {
    id: "l1",
    status: "error",
    error: "a = 5",
  });

  expect(card).toHaveAttribute("data-engine-status", "error");
  expect(card).toHaveClass("border-loss");
  expect(card).not.toHaveClass("border-outline");
  expect(textarea).toHaveAttribute("aria-invalid", "true");
  expect(description(textarea)).toBe("Error: a = 5.");

  const mark = document.querySelector("[data-line-annotation='error']");
  expect(mark).toHaveTextContent("a = 5");
  expect(mark).toHaveClass("text-loss");
  expect(document.querySelector("[data-line-annotation='suggestion']")).toBeNull();
});

test("shows a focused suggestion at the caret end with a gutter space", () => {
  const { card, highlight, textarea } = renderCard("a =", {
    id: "l1",
    status: "incomplete",
    suggestion: { display: "5", insert: "5" },
  });

  expect(document.querySelector("[data-line-annotation='suggestion']")).toBeNull();
  expect(textarea).not.toHaveAttribute("aria-describedby");

  focusAtEnd(textarea);

  expect(card).toHaveAttribute("data-engine-status", "incomplete");
  expect(highlight?.textContent).toBe("a = 5");

  const mark = document.querySelector("[data-line-annotation='suggestion']");
  expect(mark).toHaveTextContent("5");
  expect(mark).toHaveClass("text-on-surface-variant");
  expect(description(textarea)).toBe("Suggestion: 5. Press Tab to accept 5.");
});

test("hides the suggestion when unfocused or the caret is not at the end", () => {
  const { textarea } = renderCard("a =", {
    id: "l1",
    status: "incomplete",
    suggestion: { display: "5", insert: "5" },
  });

  expect(document.querySelector("[data-line-annotation='suggestion']")).toBeNull();

  fireEvent.focus(textarea);
  textarea.setSelectionRange(0, 0);
  fireEvent.select(textarea);
  expect(document.querySelector("[data-line-annotation='suggestion']")).toBeNull();

  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  fireEvent.select(textarea);
  expect(document.querySelector("[data-line-annotation='suggestion']")).not.toBeNull();

  fireEvent.blur(textarea);
  expect(document.querySelector("[data-line-annotation='suggestion']")).toBeNull();
});

test("renders a skipped line as muted plain text without token spans", () => {
  const { card, highlight, textarea } = renderCard("2 + 3 = 5", {
    id: "l1",
    status: "skipped",
  });

  expect(card).toHaveAttribute("data-engine-status", "skipped");
  expect(highlight).toHaveTextContent("2 + 3 = 5");
  expect(highlight).toHaveClass("text-on-surface-variant");
  expect(highlight?.querySelectorAll(".text-primary, .text-tertiary")).toHaveLength(0);
  expect(textarea).not.toBeDisabled();
  expect(screen.getByRole("button", { name: "Move line 1" })).toHaveClass(
    "text-on-surface-variant",
  );
  expect(document.querySelector("[data-line-annotation]")).toBeNull();
});

test("renders no annotation for ok, empty or bare incomplete lines", () => {
  const view = (annotation?: LineEvaluation) => (
    <ol>
      <LineCard
        line={{ id: "l1", text: "2" }}
        index={0}
        total={1}
        annotation={annotation}
        onAction={() => {}}
      />
    </ol>
  );
  const { rerender } = render(view());

  expect(document.querySelector("[data-line-annotation]")).toBeNull();
  expect(screen.getByRole("listitem")).toHaveAttribute("data-engine-status", "none");

  rerender(view({ id: "l1", status: "ok" }));
  expect(document.querySelector("[data-line-annotation]")).toBeNull();

  rerender(view({ id: "l1", status: "empty" }));
  expect(document.querySelector("[data-line-annotation]")).toBeNull();

  rerender(view({ id: "l1", status: "incomplete" }));
  expect(document.querySelector("[data-line-annotation]")).toBeNull();
  expect(screen.getByRole("listitem")).toHaveAttribute("data-engine-status", "incomplete");
  expect(screen.getByRole("textbox", { name: "Line 1" })).not.toHaveAttribute("aria-describedby");
});

test("does not add a second gutter space after trailing whitespace", () => {
  const { highlight, textarea } = renderCard("a = ", {
    id: "l1",
    status: "incomplete",
    suggestion: { display: "5", insert: "5" },
  });

  focusAtEnd(textarea);

  expect(highlight?.textContent).toBe("a = 5");
});

test("Tab prefers execCommand and leaves the native edit alone when it changes the value", () => {
  const { onAction, textarea } = renderCard("a =", {
    id: "l1",
    status: "incomplete",
    suggestion: { display: "5", insert: "5" },
  });
  focusAtEnd(textarea);
  const execCommand = stubExecCommand(() => {
    textarea.value = `${textarea.value} 5`;
    return true;
  });

  const notPrevented = fireEvent.keyDown(textarea, { key: "Tab" });

  expect(notPrevented).toBe(false);
  expect(execCommand).toHaveBeenCalledWith("insertText", false, " 5");
  expect(onAction).not.toHaveBeenCalled();
});

test("falls back to the change action when execCommand declines", () => {
  const { onAction, textarea } = renderCard("a =", {
    id: "l1",
    status: "incomplete",
    suggestion: { display: "5", insert: "5" },
  });
  focusAtEnd(textarea);
  const execCommand = stubExecCommand(() => false);

  fireEvent.keyDown(textarea, { key: "Tab" });

  expect(execCommand).toHaveBeenCalledWith("insertText", false, " 5");
  expect(onAction).toHaveBeenCalledWith({ type: "change", text: "a = 5" });
});

test("falls back when execCommand reports success but leaves the value unchanged", () => {
  const { onAction, textarea } = renderCard("a =", {
    id: "l1",
    status: "incomplete",
    suggestion: { display: "5", insert: "5" },
  });
  focusAtEnd(textarea);
  stubExecCommand(() => true);

  fireEvent.keyDown(textarea, { key: "Tab" });

  expect(onAction).toHaveBeenCalledWith({ type: "change", text: "a = 5" });
});

test("the non-symmetric fallback inserts the largest value, not the display", () => {
  const { onAction, textarea } = renderCard("x =", {
    id: "l1",
    status: "incomplete",
    suggestion: { display: "11, 5", insert: "11" },
  });
  focusAtEnd(textarea);
  const execCommand = stubExecCommand(() => false);

  fireEvent.keyDown(textarea, { key: "Tab" });

  expect(execCommand).toHaveBeenCalledWith("insertText", false, " 11");
  expect(onAction).toHaveBeenCalledWith({ type: "change", text: "x = 11" });
});

test("Escape dismisses the ghost and hint until the line text changes", () => {
  const annotation: LineEvaluation = {
    id: "l1",
    status: "incomplete",
    suggestion: { display: "5", insert: "5" },
  };
  const onAction = vi.fn();
  const view = (text: string) => (
    <ol>
      <LineCard
        line={{ id: "l1", text }}
        index={0}
        total={1}
        annotation={annotation}
        onAction={onAction}
      />
    </ol>
  );
  const { rerender } = render(view("a ="));
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Line 1" });
  focusAtEnd(textarea);

  expect(document.querySelector("[data-line-annotation='suggestion']")).not.toBeNull();
  expect(description(textarea)).toBe("Suggestion: 5. Press Tab to accept 5.");

  const notPrevented = fireEvent.keyDown(textarea, { key: "Escape" });

  expect(notPrevented).toBe(false);
  expect(textarea).toHaveValue("a =");
  expect(document.querySelector("[data-line-annotation='suggestion']")).toBeNull();
  expect(textarea).not.toHaveAttribute("aria-describedby");

  const tabNotPrevented = fireEvent.keyDown(textarea, { key: "Tab" });
  expect(tabNotPrevented).toBe(true);
  expect(onAction).not.toHaveBeenCalled();

  rerender(view("a = "));

  expect(document.querySelector("[data-line-annotation='suggestion']")).not.toBeNull();
  expect(description(textarea)).toBe("Suggestion: 5. Press Tab to accept 5.");
});

test("Escape without a visible suggestion is left to the textarea", () => {
  const { onAction, textarea } = renderCard("a =", { id: "l1", status: "ok" });

  const notPrevented = fireEvent.keyDown(textarea, { key: "Escape" });

  expect(notPrevented).toBe(true);
  expect(onAction).not.toHaveBeenCalled();
});

test("restores the caret after the controlled fallback renders", async () => {
  const annotation: LineEvaluation = {
    id: "l1",
    status: "incomplete",
    suggestion: { display: "5", insert: "5" },
  };
  const onAction = vi.fn();
  const view = (text: string) => (
    <ol>
      <LineCard
        line={{ id: "l1", text }}
        index={0}
        total={1}
        annotation={annotation}
        onAction={onAction}
      />
    </ol>
  );
  const { rerender } = render(view("a ="));
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Line 1" });
  focusAtEnd(textarea);
  stubExecCommand(() => false);

  fireEvent.keyDown(textarea, { key: "Tab" });
  expect(onAction).toHaveBeenCalledWith({ type: "change", text: "a = 5" });

  rerender(view("a = 5"));

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });

  expect(textarea.selectionStart).toBe(5);
  expect(textarea.selectionEnd).toBe(5);
});
