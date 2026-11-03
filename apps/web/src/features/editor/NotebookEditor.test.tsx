import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { db } from "../../data/db.ts";
import type { Notebook } from "../../data/models.ts";
import { createNotebook, getNotebook, updateNotebook } from "../../data/notebooks.ts";
import * as notebookRepository from "../../data/notebooks.ts";
import { NotebookEditor } from "./NotebookEditor.tsx";

function getLine(name: string): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name });
}

async function seedNotebook(texts: string[]): Promise<Notebook> {
  const notebook = await createNotebook("Alpha");
  const lines = texts.map((text) => ({ id: crypto.randomUUID(), text }));

  return updateNotebook(notebook.id, { lines });
}

async function storedTexts(notebookId: string): Promise<string[] | undefined> {
  const notebook = await getNotebook(notebookId);

  return notebook?.lines.map((line) => line.text);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

test("renders one card for a new notebook and focuses its first line", async () => {
  const notebook = await seedNotebook([""]);

  render(<NotebookEditor notebook={notebook} />);

  const line = getLine("Line 1");

  await waitFor(() => {
    expect(line).toHaveFocus();
  });
  expect(line).toHaveValue("");
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
});

test("typing updates the card and persists the line", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook([""]);

  render(<NotebookEditor notebook={notebook} />);

  const line = getLine("Line 1");

  await user.type(line, "hello");

  expect(line).toHaveValue("hello");
  await waitFor(async () => {
    await expect(storedTexts(notebook.id)).resolves.toEqual(["hello"]);
  });
});

test("highlights math tokens behind the text without duplicating the line", async () => {
  const notebook = await seedNotebook(["2 + 3 = 5"]);

  render(<NotebookEditor notebook={notebook} />);

  const line = getLine("Line 1");
  const highlight = document.querySelector("[data-line-highlight]");

  expect(line).toHaveValue("2 + 3 = 5");
  expect(highlight).toHaveAttribute("aria-hidden", "true");
  expect(highlight).toHaveTextContent("2 + 3 = 5");
  expect(highlight?.querySelectorAll(".text-primary")).toHaveLength(3);
  expect(highlight?.querySelectorAll(".text-tertiary")).toHaveLength(2);
});

test("loading a notebook writes nothing on its own", async () => {
  const notebook = await seedNotebook(["loaded"]);
  const updateSpy = vi.spyOn(notebookRepository, "updateNotebook");

  render(<NotebookEditor notebook={notebook} />);

  await waitFor(() => {
    expect(getLine("Line 1")).toHaveValue("loaded");
  });
  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(updateSpy).not.toHaveBeenCalled();
});

test("text edits wait for the autosave debounce before writing", async () => {
  const notebook = await seedNotebook([""]);
  const updateSpy = vi.spyOn(notebookRepository, "updateNotebook");

  render(<NotebookEditor notebook={notebook} />);

  const line = getLine("Line 1");

  fireEvent.change(line, { target: { value: "debounced" } });

  expect(line).toHaveValue("debounced");
  expect(updateSpy).not.toHaveBeenCalled();

  await waitFor(
    () => {
      expect(updateSpy).toHaveBeenCalledOnce();
    },
    { timeout: 1_500 },
  );
  await expect(storedTexts(notebook.id)).resolves.toEqual(["debounced"]);
});

test("a structure change writes immediately and cancels pending text", async () => {
  const notebook = await seedNotebook(["ab"]);
  const updateSpy = vi.spyOn(notebookRepository, "updateNotebook");

  render(<NotebookEditor notebook={notebook} />);

  const line = getLine("Line 1");

  fireEvent.change(line, { target: { value: "abc" } });
  line.setSelectionRange(3, 3);
  fireEvent.keyDown(line, { key: "Enter" });

  expect(updateSpy).toHaveBeenCalledOnce();
  expect(updateSpy.mock.calls[0]?.[1].lines?.map((item) => item.text)).toEqual(["abc", ""]);

  // The pending text snapshot was cancelled, so no second write arrives after
  // the debounce window and the structure remains the newest version.
  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(updateSpy).toHaveBeenCalledOnce();
  await expect(storedTexts(notebook.id)).resolves.toEqual(["abc", ""]);
});

test("Enter splits at the caret and focuses the new card", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook(["alpha beta"]);

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  first.setSelectionRange(5, 5);
  await user.keyboard("{Enter}");

  const second = await screen.findByRole<HTMLTextAreaElement>("textbox", { name: "Line 2" });

  expect(first).toHaveValue("alpha");
  expect(second).toHaveValue(" beta");
  await waitFor(() => {
    expect(second).toHaveFocus();
  });
  expect(second.selectionStart).toBe(0);
  await waitFor(async () => {
    await expect(storedTexts(notebook.id)).resolves.toEqual(["alpha", " beta"]);
  });
});

test("Enter over a selection removes the selected text and splits", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook(["alpha beta"]);

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  first.setSelectionRange(0, 5);
  await user.keyboard("{Enter}");

  const second = await screen.findByRole<HTMLTextAreaElement>("textbox", { name: "Line 2" });

  expect(screen.getAllByRole("textbox")).toHaveLength(2);
  expect(first).toHaveValue("");
  expect(second).toHaveValue(" beta");
  await waitFor(() => {
    expect(second).toHaveFocus();
  });
  expect(second.selectionStart).toBe(0);
});

test("Backspace at the start merges into the previous card and focuses the join", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook(["alpha", "beta"]);

  render(<NotebookEditor notebook={notebook} />);

  const second = getLine("Line 2");

  await user.click(second);
  second.setSelectionRange(0, 0);
  await user.keyboard("{Backspace}");

  const first = getLine("Line 1");

  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(first).toHaveValue("alphabeta");
  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  expect(first.selectionStart).toBe(5);
});

test("Delete at the end merges the next card and keeps the caret", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook(["alpha", "beta"]);

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  first.setSelectionRange(5, 5);
  await user.keyboard("{Delete}");

  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(first).toHaveValue("alphabeta");
  expect(first.selectionStart).toBe(5);
});

test("pasting CRLF text splits it across cards and focuses after the last part", async () => {
  const notebook = await seedNotebook(["ab"]);

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  first.setSelectionRange(1, 1);
  fireEvent.paste(first, {
    clipboardData: {
      getData: () => "X\r\nY",
    },
  });

  const second = await screen.findByRole<HTMLTextAreaElement>("textbox", { name: "Line 2" });

  expect(screen.getAllByRole("textbox")).toHaveLength(2);
  expect(first).toHaveValue("aX");
  expect(second).toHaveValue("Yb");
  await waitFor(() => {
    expect(second).toHaveFocus();
  });
  expect(second.selectionStart).toBe(1);
});

test("pasting multiline text over a selection replaces the selection", async () => {
  const notebook = await seedNotebook(["abcdef"]);

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  first.setSelectionRange(1, 4);
  fireEvent.paste(first, {
    clipboardData: {
      getData: () => "X\r\nY",
    },
  });

  const second = await screen.findByRole<HTMLTextAreaElement>("textbox", { name: "Line 2" });

  expect(screen.getAllByRole("textbox")).toHaveLength(2);
  expect(first).toHaveValue("aX");
  expect(second).toHaveValue("Yef");
  await waitFor(() => {
    expect(second).toHaveFocus();
  });
  expect(second.selectionStart).toBe(1);
});

test("single-line paste is left to the browser", async () => {
  const notebook = await seedNotebook(["ab"]);

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });

  const event = fireEvent.paste(first, {
    clipboardData: {
      getData: () => "plain",
    },
  });

  // Not prevented, so the browser's default paste path stays in charge.
  expect(event).toBe(true);
  expect(first).toHaveValue("ab");
});

test("Arrow Up and Down move between cards and preserve the caret column", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook(["first", "second"]);

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");
  const second = getLine("Line 2");

  await user.click(second);
  second.setSelectionRange(3, 3);
  await user.keyboard("{ArrowUp}");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  expect(first.selectionStart).toBe(3);

  first.setSelectionRange(5, 5);
  await user.keyboard("{ArrowDown}");

  await waitFor(() => {
    expect(second).toHaveFocus();
  });
  expect(second.selectionStart).toBe(5);
});

test("Arrow Up at the start of a line moves to the previous card", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook(["first", "second"]);

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");
  const second = getLine("Line 2");

  await user.click(second);
  second.setSelectionRange(0, 0);
  await user.keyboard("{ArrowUp}");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  expect(first.selectionStart).toBe(0);
});

test("arrow navigation only moves focus and never persists", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook(["first", "second"]);
  const updateSpy = vi.spyOn(notebookRepository, "updateNotebook");

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");
  const second = getLine("Line 2");

  await user.click(second);
  second.setSelectionRange(0, 0);
  await user.keyboard("{ArrowUp}");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  expect(updateSpy).not.toHaveBeenCalled();

  // Prove the spy intercepts the hook's write path, not that it is inert.
  await user.type(first, "x");
  await waitFor(() => {
    expect(updateSpy).toHaveBeenCalled();
  });
});

test("a single empty card cannot be merged away", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook([""]);

  render(<NotebookEditor notebook={notebook} />);

  const only = getLine("Line 1");

  await waitFor(() => {
    expect(only).toHaveFocus();
  });
  only.setSelectionRange(0, 0);
  await user.keyboard("{Backspace}{Delete}");

  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(only).toHaveValue("");
});

test("Enter with a modifier does not split or insert a newline", async () => {
  const user = userEvent.setup();
  const notebook = await seedNotebook(["alpha"]);

  render(<NotebookEditor notebook={notebook} />);

  const first = getLine("Line 1");

  await waitFor(() => {
    expect(first).toHaveFocus();
  });
  first.setSelectionRange(5, 5);
  await user.keyboard("{Shift>}{Enter}{/Shift}");

  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(first).toHaveValue("alpha");
});

test("loads fresh lines when a stale notebook prop is rendered again", async () => {
  const user = userEvent.setup();
  const first = await createNotebook("First");
  const second = await createNotebook("Second");
  const { rerender } = render(<NotebookEditor key={first.id} notebook={first} />);

  const line = getLine("Line 1");

  await user.type(line, "saved");
  await waitFor(async () => {
    await expect(storedTexts(first.id)).resolves.toEqual(["saved"]);
  });

  rerender(<NotebookEditor key={second.id} notebook={second} />);
  await waitFor(() => {
    expect(getLine("Line 1")).toHaveValue("");
  });

  rerender(<NotebookEditor key={first.id} notebook={first} />);
  await waitFor(() => {
    expect(getLine("Line 1")).toHaveValue("saved");
  });
});
