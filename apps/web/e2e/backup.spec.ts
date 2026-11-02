import { expect, test, type Download, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type NotebookFile = {
  id: string;
  title: string;
  lines: { id: string; text: string }[];
  pinned: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

type BackupFile = {
  format: string;
  version: number;
  exportedAt: string;
  notebooks: NotebookFile[];
  settings: { theme: string | null; accent: string };
};

type StoredNotebook = Omit<NotebookFile, "pinned"> & { pinned: number };

async function readNotebooks(page: Page): Promise<StoredNotebook[]> {
  return await page.evaluate<StoredNotebook[]>(`new Promise((resolve, reject) => {
    const open = indexedDB.open("inlign");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction("notebooks", "readonly").objectStore("notebooks").getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    };
  })`);
}

async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });

  await expect(dialog).toBeVisible();

  return dialog;
}

async function createNotebook(page: Page, title: string, lines: string[] = []): Promise<void> {
  const sidebar = page.getByRole("complementary", { name: "Notebooks" });

  await sidebar.getByRole("button", { name: "New notebook" }).click();
  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const input = page.getByRole("textbox", { name: "Notebook title" });

  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByTestId("active-title")).toHaveText(title);

  const first = lines[0];

  if (first !== undefined) {
    await page.getByRole("textbox", { name: "Line 1" }).fill(first);
  }

  for (let index = 1; index < lines.length; index += 1) {
    await page.getByRole("textbox", { name: `Line ${String(index)}` }).press("Enter");
    await page.getByRole("textbox", { name: `Line ${String(index + 1)}` }).fill(lines[index]!);
  }
}

async function renameNotebook(page: Page, from: string, to: string): Promise<void> {
  const sidebar = page.getByRole("complementary", { name: "Notebooks" });

  await sidebar.getByRole("button", { name: `Actions for ${from}` }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const input = page.getByRole("textbox", { name: "Notebook title" });

  await input.fill(to);
  await input.press("Enter");
  await expect(sidebar.getByRole("button", { name: to, exact: true })).toBeVisible();
}

async function deleteNotebook(page: Page, title: string): Promise<void> {
  const sidebar = page.getByRole("complementary", { name: "Notebooks" });

  await sidebar.getByRole("button", { name: `Actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  const confirm = page.getByRole("dialog", { name: "Delete notebook?" });

  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(sidebar.getByRole("button", { name: title, exact: true })).toHaveCount(0);
}

async function exportBackup(page: Page, dialog: Locator): Promise<BackupFile> {
  const downloadPromise = page.waitForEvent("download");

  await dialog.getByRole("button", { name: "Export backup" }).click();

  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("inlign-backup.json");

  return await readDownload<BackupFile>(download);
}

async function readDownload<T>(download: Download): Promise<T> {
  const path = await download.path();

  if (!path) {
    throw new Error("The download has no local path");
  }

  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function chooseBackupFile(dialog: Locator, backup: unknown): Promise<void> {
  await dialog.locator('input[accept*="application/json"]').setInputFiles({
    name: "inlign-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
}

async function importResponse(page: Page): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name: "Import backup" });

  await expect(dialog).toBeVisible();

  return dialog;
}

test("add restores copies with fresh ids and keeps current notebooks", async ({ page }) => {
  await page.goto("/");
  await createNotebook(page, "Alpha", ["one", "two"]);

  const settings = await openSettings(page);
  const backup = await exportBackup(page, settings);

  expect(backup.format).toBe("inlign-backup");
  expect(backup.notebooks.map((notebook) => notebook.title)).toEqual(["Alpha"]);
  await settings.getByRole("button", { name: "Done" }).click();
  await expect(settings).toBeHidden();

  await createNotebook(page, "Local only", ["local line"]);

  const before = await readNotebooks(page);
  const reopened = await openSettings(page);

  await chooseBackupFile(reopened, backup);

  const dialog = await importResponse(page);

  await expect(dialog.getByText("This backup contains 1 notebook and 2 lines.")).toBeVisible();

  await dialog.getByRole("button", { name: "Add as new" }).click();
  await expect(dialog).toBeHidden();

  await reopened.getByRole("button", { name: "Done" }).click();
  await expect(reopened).toBeHidden();

  const after = await readNotebooks(page);
  const alphas = after.filter((notebook) => notebook.title === "Alpha");

  expect(after).toHaveLength(before.length + 1);
  expect(alphas).toHaveLength(2);
  expect(new Set(alphas.map((notebook) => notebook.id)).size).toBe(2);
  expect(after.filter((notebook) => notebook.title === "Local only")).toHaveLength(1);

  const lineIds = alphas.flatMap((notebook) => notebook.lines.map((line) => line.id));

  expect(new Set(lineIds).size).toBe(lineIds.length);
  expect(alphas.every((notebook) => notebook.lines[1]?.text === "two")).toBe(true);
  await expect(
    page
      .getByRole("complementary", { name: "Notebooks" })
      .getByRole("button", { name: "Alpha", exact: true }),
  ).toHaveCount(2);
});

test("merge updates matching ids, adds missing notebooks and keeps unknown ones", async ({
  page,
}) => {
  await page.goto("/");
  await createNotebook(page, "Alpha", ["alpha line"]);
  await createNotebook(page, "Beta", ["beta line"]);

  const settings = await openSettings(page);
  const backup = await exportBackup(page, settings);

  await settings.getByText("Dark", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await settings.getByRole("button", { name: "Done" }).click();
  await expect(settings).toBeHidden();

  await renameNotebook(page, "Alpha", "Alpha mutated");
  await deleteNotebook(page, "Beta");
  await createNotebook(page, "Local only", ["local line"]);

  const local = (await readNotebooks(page)).find((notebook) => notebook.title === "Local only");

  expect(local).toBeDefined();

  const reopened = await openSettings(page);

  await chooseBackupFile(reopened, backup);

  const dialog = await importResponse(page);

  await expect(dialog.getByText("This backup contains 2 notebooks and 2 lines.")).toBeVisible();

  await dialog.getByRole("button", { name: "Merge" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await reopened.getByRole("button", { name: "Done" }).click();
  await expect(reopened).toBeHidden();

  const after = await readNotebooks(page);
  const byTitle = new Map(after.map((notebook) => [notebook.title, notebook]));

  expect([...byTitle.keys()].sort()).toEqual(["Alpha", "Beta", "Local only"]);
  expect(byTitle.get("Alpha")?.id).toBe(backup.notebooks.find((n) => n.title === "Alpha")?.id);
  expect(byTitle.get("Alpha")?.lines[0]?.text).toBe("alpha line");
  expect(byTitle.get("Beta")?.lines[0]?.text).toBe("beta line");
  expect(byTitle.get("Local only")?.id).toBe(local?.id);
  expect(byTitle.has("Alpha mutated")).toBe(false);
});

test("replace downloads a safety backup first, then restores only the import and its settings", async ({
  page,
}) => {
  await page.goto("/");
  await createNotebook(page, "Export A", ["a line"]);
  await createNotebook(page, "Export B", ["b line"]);

  const settings = await openSettings(page);

  await settings.getByText("Light", { exact: true }).click();
  await settings.getByText("Teal", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "teal");

  const backup = await exportBackup(page, settings);

  expect(backup.settings).toEqual({ theme: "light", accent: "teal" });

  // Mutate the appearance after exporting so Replace must restore these two.
  await settings.getByText("Dark", { exact: true }).click();
  await settings.getByText("Violet", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await settings.getByRole("button", { name: "Done" }).click();
  await expect(settings).toBeHidden();

  await deleteNotebook(page, "Export A");
  await renameNotebook(page, "Export B", "Export B mutated");
  await createNotebook(page, "Local only", ["local line"]);

  const reopened = await openSettings(page);

  await chooseBackupFile(reopened, backup);

  const dialog = await importResponse(page);

  await expect(dialog.getByText("This backup contains 2 notebooks and 2 lines.")).toBeVisible();

  const safetyPromise = page.waitForEvent("download");

  await dialog.getByRole("button", { name: "Replace all" }).click();

  const safetyDownload = await safetyPromise;

  expect(safetyDownload.suggestedFilename()).toBe("inlign-backup.json");

  const safety = await readDownload<BackupFile>(safetyDownload);

  expect(safety.notebooks.map((notebook) => notebook.title).sort()).toEqual([
    "Export B mutated",
    "Local only",
  ]);
  expect(safety.settings).toEqual({ theme: "dark", accent: "violet" });

  await expect(page.getByRole("dialog", { name: "Replace all data?" })).toBeVisible();

  await page.getByRole("button", { name: "Replace all data" }).click();

  await expect(page.getByRole("dialog", { name: "Replace all data?" })).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "teal");

  await reopened.getByRole("button", { name: "Done" }).click();
  await expect(reopened).toBeHidden();

  const after = await readNotebooks(page);

  expect(after.map((notebook) => notebook.title).sort()).toEqual(["Export A", "Export B"]);
  expect(after.find((notebook) => notebook.title === "Export A")?.lines[0]?.text).toBe("a line");
  expect(after.find((notebook) => notebook.title === "Export B")?.lines[0]?.text).toBe("b line");

  const sidebar = page.getByRole("complementary", { name: "Notebooks" });

  await expect(sidebar.getByRole("button", { name: "Local only", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: "Export B mutated", exact: true })).toHaveCount(
    0,
  );
});

test.describe("short landscape", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("keeps the import choices and the replace confirmation usable", async ({ page }) => {
    await page.goto("/");
    await createNotebook(page, "Landscape", ["line"]);

    const settings = await openSettings(page);
    const backup = await exportBackup(page, settings);

    await chooseBackupFile(settings, backup);

    const dialog = await importResponse(page);

    for (const name of ["Cancel", "Add as new", "Merge", "Replace all"]) {
      const button = dialog.getByRole("button", { name });
      const box = await button.boundingBox();

      await expect(button).toBeVisible();

      if (!box) {
        throw new Error(`${name} is not laid out`);
      }

      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(390);
    }

    const safetyPromise = page.waitForEvent("download");

    await dialog.getByRole("button", { name: "Replace all" }).click();

    await safetyPromise;
    await expect(page.getByRole("dialog", { name: "Replace all data?" })).toBeVisible();

    const keep = page.getByRole("button", { name: "Keep current data" });
    const keepBox = await keep.boundingBox();

    if (!keepBox) {
      throw new Error("Keep current data is not laid out");
    }

    expect(keepBox.y + keepBox.height).toBeLessThanOrEqual(390);

    await keep.click();
    await expect(page.getByRole("dialog", { name: "Import backup" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });
});

test("invalid JSON and schema errors stay inline and write nothing", async ({ page }) => {
  await page.goto("/");
  await createNotebook(page, "Guardian", ["keep me"]);

  const before = await readNotebooks(page);
  const beforeTheme = await page.locator("html").getAttribute("data-theme");
  const settings = await openSettings(page);
  const input = settings.locator('input[accept*="application/json"]');

  await input.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ not json"),
  });

  await expect(settings.getByRole("alert")).toContainText("Could not import broken.json");
  await expect(page.getByRole("dialog", { name: "Import backup" })).toHaveCount(0);

  await input.setInputFiles({
    name: "wrong-shape.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "inlign-backup", version: 2, notebooks: [] })),
  });

  await expect(settings.getByRole("alert")).toContainText("Invalid backup file");
  await expect(page.getByRole("dialog", { name: "Import backup" })).toHaveCount(0);
  expect(await page.locator("html").getAttribute("data-theme")).toBe(beforeTheme);

  await settings.getByRole("button", { name: "Done" }).click();
  await expect(settings).toBeHidden();

  expect(await readNotebooks(page)).toEqual(before);
  await expect(
    page.getByRole("complementary", { name: "Notebooks" }).getByRole("button", {
      name: "Guardian",
      exact: true,
    }),
  ).toBeVisible();
});
