import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "../../app/App.tsx";
import { db } from "../../data/db.ts";
import type { Settings } from "../../data/models.ts";
import * as settingsData from "../../data/settings.ts";

vi.mock("../../data/settings.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof settingsData>();

  return { ...actual, getSettings: vi.fn(actual.getSettings) };
});

const getSettingsMock = vi.mocked(settingsData.getSettings);

beforeEach(async () => {
  await db.delete();
  await db.open();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  const root = document.documentElement;

  root.removeAttribute("data-theme");
  root.removeAttribute("data-accent");
  root.style.colorScheme = "";
  document.querySelector('meta[name="theme-color"]')?.remove();
});

async function openSettings() {
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Settings" }));

  return { user, dialog: screen.getByRole("dialog", { name: "Settings" }) };
}

test("opens from the top bar, shows both sections and closes with Done", async () => {
  render(<App />);

  const opener = screen.getByRole("button", { name: "Settings" });

  expect(opener).toBeEnabled();
  expect(opener).toHaveAttribute("aria-haspopup", "dialog");

  const { user, dialog } = await openSettings();

  expect(within(dialog).getByText("Appearance")).toBeInTheDocument();
  expect(within(dialog).getByText("Data")).toBeInTheDocument();
  expect(
    within(dialog).getByText("Import and export actions will appear here."),
  ).toBeInTheDocument();
  expect(within(dialog).getByRole("group", { name: "Theme" })).toBeInTheDocument();
  expect(within(dialog).getByRole("group", { name: "Accent" })).toBeInTheDocument();

  await user.click(within(dialog).getByRole("button", { name: "Done" }));

  expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test("switching theme applies immediately and persists to the mirror and Dexie", async () => {
  render(<App />);

  const { user, dialog } = await openSettings();

  await user.click(within(dialog).getByRole("radio", { name: "Dark" }));

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(window.localStorage.getItem("inlign.theme")).toBe("dark");
  expect(within(dialog).getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(within(dialog).getByRole("radio", { name: "Light" })).not.toBeChecked();

  await waitFor(async () => {
    await expect(settingsData.getSettings()).resolves.toMatchObject({ theme: "dark" });
  });
});

test("switching accent applies immediately and persists to the mirror and Dexie", async () => {
  render(<App />);

  const { user, dialog } = await openSettings();

  await user.click(within(dialog).getByRole("radio", { name: "Rose" }));

  expect(document.documentElement.dataset.accent).toBe("rose");
  expect(window.localStorage.getItem("inlign.accent")).toBe("rose");
  expect(within(dialog).getByRole("radio", { name: "Rose" })).toBeChecked();
  expect(within(dialog).getByRole("radio", { name: "Blue" })).not.toBeChecked();
  expect(
    within(dialog)
      .getByRole("radio", { name: "Rose" })
      .closest("label")
      ?.querySelector('[data-accent="rose"]'),
  ).not.toBeNull();

  await waitFor(async () => {
    await expect(settingsData.getSettings()).resolves.toMatchObject({ accent: "rose" });
  });
});

test("reopening and remounting keeps the stored choice", async () => {
  await settingsData.setSetting("theme", "oled");
  await settingsData.setSetting("accent", "violet");

  render(<App />);

  await waitFor(() => {
    expect(document.documentElement.dataset.theme).toBe("oled");
  });
  expect(document.documentElement.dataset.accent).toBe("violet");

  const first = await openSettings();

  expect(within(first.dialog).getByRole("radio", { name: "OLED" })).toBeChecked();
  expect(within(first.dialog).getByRole("radio", { name: "Violet" })).toBeChecked();

  await first.user.click(within(first.dialog).getByRole("button", { name: "Done" }));

  const second = await openSettings();

  expect(within(second.dialog).getByRole("radio", { name: "OLED" })).toBeChecked();
  expect(within(second.dialog).getByRole("radio", { name: "Violet" })).toBeChecked();

  cleanup();
  render(<App />);

  await waitFor(() => {
    expect(document.documentElement.dataset.theme).toBe("oled");
  });

  const remounted = await openSettings();

  expect(within(remounted.dialog).getByRole("radio", { name: "OLED" })).toBeChecked();
  expect(within(remounted.dialog).getByRole("radio", { name: "Violet" })).toBeChecked();
});

test("a slow settings load does not overwrite a choice made before it resolves", async () => {
  let resolveLoad: (settings: Settings) => void = () => {};
  const load = new Promise<Settings>((resolve) => {
    resolveLoad = resolve;
  });

  getSettingsMock.mockReturnValueOnce(load);

  render(<App />);

  const { dialog } = await openSettings();

  await userEvent.setup().click(within(dialog).getByRole("radio", { name: "Dark" }));

  expect(document.documentElement.dataset.theme).toBe("dark");

  resolveLoad({ theme: "light", accent: "rose" });

  await waitFor(() => {
    expect(document.documentElement.dataset.accent).toBe("rose");
  });

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(window.localStorage.getItem("inlign.theme")).toBe("dark");
  expect(within(dialog).getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(within(dialog).getByRole("radio", { name: "Rose" })).toBeChecked();
});
