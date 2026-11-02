import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test } from "vitest";

import { db } from "../data/db.ts";
import { listNotebooks } from "../data/notebooks.ts";
import App from "./App.tsx";

beforeEach(async () => {
  await db.delete();
  await db.open();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

test("first run shows the empty state and creates nothing by itself", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: "No notebooks yet" })).toBeInTheDocument();
  expect(screen.getByTestId("active-title")).toHaveTextContent("");

  await waitFor(() => {
    expect(screen.getByText("No notebooks yet.")).toBeInTheDocument();
  });

  await expect(listNotebooks()).resolves.toEqual([]);
});

test("creating from the empty state selects the new notebook", async () => {
  const user = userEvent.setup();

  render(<App />);

  const main = screen.getByRole("main");

  await user.click(await within(main).findByRole("button", { name: "New notebook" }));

  await waitFor(() => {
    expect(screen.getByTestId("active-title")).toHaveTextContent("Untitled");
  });
  await waitFor(() => {
    expect(screen.getByRole("textbox", { name: "Line 1" })).toHaveFocus();
  });
  expect(screen.queryByRole("heading", { name: "No notebooks yet" })).not.toBeInTheDocument();
  await expect(listNotebooks()).resolves.toHaveLength(1);
});

test("the settings button opens the settings dialog and closes with Escape", async () => {
  const user = userEvent.setup();

  render(<App />);

  const opener = screen.getByRole("button", { name: "Settings" });

  expect(opener).toBeEnabled();

  await user.click(opener);

  expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
