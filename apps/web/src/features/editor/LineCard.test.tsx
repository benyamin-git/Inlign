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

afterEach(() => {
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
