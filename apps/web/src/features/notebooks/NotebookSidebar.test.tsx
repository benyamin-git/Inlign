import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { db } from "../../data/db.ts";
import { createNotebook, getNotebook, listNotebooks } from "../../data/notebooks.ts";
import { NotebookSidebar } from "./NotebookSidebar.tsx";
import { useNotebooks } from "./useNotebooks.ts";

function Harness({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const model = useNotebooks();

  return (
    <NotebookSidebar
      notebooks={model.notebooks}
      activeId={model.activeId}
      onSelect={model.select}
      onCreate={model.create}
      onRename={model.rename}
      onSetPinned={model.setPinned}
      onSetIgnoreCase={model.setIgnoreCase}
      onDelete={model.remove}
      onReorder={model.reorder}
      onNavigate={onNavigate}
    />
  );
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  cleanup();
});

test("shows the empty list and creates a notebook from the sidebar", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();

  render(<Harness onNavigate={onNavigate} />);

  expect(screen.getByText("No notebooks yet.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "New notebook" }));

  expect(await screen.findByRole("button", { name: "Untitled" })).toBeInTheDocument();
  expect(onNavigate).toHaveBeenCalledTimes(1);
  await expect(listNotebooks()).resolves.toHaveLength(1);
});

test("renames inline with Enter and normalizes an empty title", async () => {
  const user = userEvent.setup();
  const notebook = await createNotebook("Alpha");

  render(<Harness />);
  await screen.findByRole("button", { name: "Alpha" });

  await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  const input = screen.getByRole("textbox", { name: "Notebook title" });

  await waitFor(() => {
    expect(input).toHaveFocus();
  });
  expect(input).toHaveValue("Alpha");

  await user.clear(input);
  await user.type(input, "Beta{Enter}");

  expect(await screen.findByRole("button", { name: "Beta" })).toBeInTheDocument();
  await waitFor(async () => {
    await expect(getNotebook(notebook.id)).resolves.toMatchObject({ title: "Beta" });
  });

  await user.click(screen.getByRole("button", { name: "Actions for Beta" }));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));
  await user.clear(screen.getByRole("textbox", { name: "Notebook title" }));
  await user.keyboard("{Enter}");

  expect(await screen.findByRole("button", { name: "Untitled" })).toBeInTheDocument();
  await expect(getNotebook(notebook.id)).resolves.toMatchObject({ title: "Untitled" });
});

test("Escape cancels a rename and keeps the original title", async () => {
  const user = userEvent.setup();
  const notebook = await createNotebook("Alpha");

  render(<Harness />);
  await screen.findByRole("button", { name: "Alpha" });

  await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  const input = screen.getByRole("textbox", { name: "Notebook title" });

  await waitFor(() => {
    expect(input).toHaveFocus();
  });
  await user.clear(input);
  await user.type(input, "Gamma");
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("textbox", { name: "Notebook title" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
  await expect(getNotebook(notebook.id)).resolves.toMatchObject({ title: "Alpha" });
});

test("blur commits a rename and returns focus to the title", async () => {
  const user = userEvent.setup();
  const notebook = await createNotebook("Alpha");

  render(<Harness />);
  await screen.findByRole("button", { name: "Alpha" });

  await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  const input = screen.getByRole("textbox", { name: "Notebook title" });

  await user.clear(input);
  await user.type(input, "Delta");
  // A null relatedTarget means focus went nowhere; the item must keep it.
  act(() => {
    input.blur();
  });

  expect(await screen.findByRole("button", { name: "Delta" })).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Delta" })).toHaveFocus();
  });
  await waitFor(async () => {
    await expect(getNotebook(notebook.id)).resolves.toMatchObject({ title: "Delta" });
  });
});

test("pins and unpins a notebook from the item menu", async () => {
  const user = userEvent.setup();
  const notebook = await createNotebook("Alpha");

  render(<Harness />);
  await screen.findByRole("button", { name: "Alpha" });

  await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));
  await user.click(screen.getByRole("menuitem", { name: "Pin notebook" }));

  expect(await screen.findByRole("heading", { name: "Pinned" })).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveFocus();
  });
  await waitFor(async () => {
    await expect(getNotebook(notebook.id)).resolves.toMatchObject({ pinned: true });
  });

  await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));
  await user.click(screen.getByRole("menuitem", { name: "Unpin notebook" }));

  await waitFor(() => {
    expect(screen.queryByRole("heading", { name: "Pinned" })).not.toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveFocus();
  });
  await expect(getNotebook(notebook.id)).resolves.toMatchObject({ pinned: false });
});

test("toggles case-insensitive variables per notebook from the item menu", async () => {
  const user = userEvent.setup();
  const notebook = await createNotebook("Alpha");

  render(<Harness />);
  await screen.findByRole("button", { name: "Alpha" });

  await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));

  const toggle = screen.getByRole("menuitemcheckbox", { name: "Ignore variable case" });

  expect(toggle).toHaveAttribute("aria-checked", "false");

  await user.click(toggle);

  await waitFor(async () => {
    await expect(getNotebook(notebook.id)).resolves.toMatchObject({ ignoreCase: true });
  });

  await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));

  expect(screen.getByRole("menuitemcheckbox", { name: "Ignore variable case" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("delete asks for confirmation, then removes the notebook", async () => {
  const user = userEvent.setup();
  const notebook = await createNotebook("Alpha");

  render(<Harness />);
  await screen.findByRole("button", { name: "Alpha" });

  await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));

  const dialog = screen.getByRole("dialog", { name: "Delete notebook?" });

  expect(within(dialog).getByText("Alpha")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
  await expect(getNotebook(notebook.id)).resolves.toBeDefined();

  await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  await user.click(
    within(screen.getByRole("dialog", { name: "Delete notebook?" })).getByRole("button", {
      name: "Delete",
    }),
  );

  await waitFor(() => {
    expect(screen.queryByRole("button", { name: "Alpha" })).not.toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "New notebook" })).toHaveFocus();
  });
  await expect(listNotebooks()).resolves.toEqual([]);
});

test("focuses the new active title after deleting the active notebook", async () => {
  const user = userEvent.setup();

  await createNotebook("Alpha");
  await createNotebook("Beta");

  render(<Harness />);
  await screen.findByRole("button", { name: "Beta" });

  await user.click(screen.getByRole("button", { name: "Actions for Beta" }));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  await user.click(
    within(screen.getByRole("dialog", { name: "Delete notebook?" })).getByRole("button", {
      name: "Delete",
    }),
  );

  await waitFor(() => {
    expect(screen.queryByRole("button", { name: "Beta" })).not.toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveFocus();
  });
});

test("the item menu supports the keyboard: arrows open and focus, Escape returns focus", async () => {
  const user = userEvent.setup();

  await createNotebook("Alpha");
  render(<Harness />);
  await screen.findByRole("button", { name: "Alpha" });

  const trigger = screen.getByRole("button", { name: "Actions for Alpha" });

  trigger.focus();
  await user.keyboard("{ArrowDown}");

  expect(screen.getByRole("menu")).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();

  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("menuitem", { name: "Pin notebook" })).toHaveFocus();

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
