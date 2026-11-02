import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test } from "vitest";

import { db } from "../../data/db.ts";
import type { Notebook } from "../../data/models.ts";
import { createNotebook, getNotebook, updateNotebook } from "../../data/notebooks.ts";
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
