import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const TITLE = "Notepad journey";
// The export filename is the slugified title; the import names the new
// notebook after the filename.
const EXPORT_TITLE = "notepad-journey";
const REORDERED_LINES = ["beta", "gamma", "alpha"];

async function lineValues(page: Page): Promise<string[]> {
  const lines = await page.getByRole("textbox").all();

  return Promise.all(lines.map((line) => line.inputValue()));
}

test("covers create, type, reorder, theme, reload, export and import", async ({ page }) => {
  await page.goto("/");

  const sidebar = page.getByRole("complementary", { name: "Notebooks" });
  const activeTitle = page.getByTestId("active-title");

  // Create and rename a notebook. Tests get a fresh context, so the title is
  // unique within the run and the export filename is deterministic.
  await sidebar.getByRole("button", { name: "New notebook" }).click();
  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const titleInput = page.getByRole("textbox", { name: "Notebook title" });

  await titleInput.fill(TITLE);
  await titleInput.press("Enter");
  await expect(activeTitle).toHaveText(TITLE);

  // Three logical lines, one card each.
  const firstLine = page.getByRole("textbox", { name: "Line 1" });

  // Renaming returns focus to the sidebar title button, so focus the editor
  // explicitly before typing.
  await firstLine.click();
  await firstLine.fill("alpha");
  await firstLine.press("Enter");
  await expect(page.getByRole("textbox", { name: "Line 2" })).toBeFocused();
  await page.keyboard.type("beta");
  await page.keyboard.press("Enter");
  await page.keyboard.type("gamma");
  await expect.poll(() => lineValues(page)).toEqual(["alpha", "beta", "gamma"]);

  // Pointer reorder: line 1 onto line 3. dnd-kit only listens to pointer
  // events, so move the real mouse across the 4 px activation distance.
  const sourceGrip = page.getByRole("button", { name: "Move line 1" });
  const targetGrip = page.getByRole("button", { name: "Move line 3" });
  const source = await sourceGrip.boundingBox();
  const target = await targetGrip.boundingBox();

  if (!source || !target) {
    throw new Error("Drag handles are not visible.");
  }

  const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 12, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();

  await expect.poll(() => lineValues(page)).toEqual(REORDERED_LINES);
  await expect(page.getByRole("button", { name: "Move line 3" })).toBeFocused();

  // dnd-kit stops click propagation at the document for 50 ms after a drag
  // ends. Let that capture listener detach before pressing the header button.
  await page.waitForTimeout(100);

  // Switch to Dark through Settings and close the dialog.
  await page.getByRole("button", { name: "Settings" }).click();

  let dialog = page.getByRole("dialog", { name: "Settings" });

  await expect(dialog).toBeVisible();
  await dialog.getByText("Dark", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  // Cover the 400 ms text autosave before reloading. The reorder and theme are
  // written immediately.
  await page.waitForTimeout(500);
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => lineValues(page)).toEqual(REORDERED_LINES);

  // Export the reloaded notebook through its sidebar menu.
  const downloadPromise = page.waitForEvent("download");

  await sidebar.getByRole("button", { name: `Actions for ${TITLE}` }).click();
  await page.getByRole("menuitem", { name: "Export .inlign" }).click();

  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(`${EXPORT_TITLE}.inlign`);

  const path = await download.path();

  if (!path) {
    throw new Error("The export download has no local path");
  }

  const bytes = await readFile(path);

  expect(bytes.toString("utf8")).toBe(REORDERED_LINES.join("\n"));

  // Import those exact bytes through Settings' .inlign input.
  await page.getByRole("button", { name: "Settings" }).click();
  dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();

  await dialog.locator('input[accept*=".inlign"]').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "text/plain",
    buffer: bytes,
  });

  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  // The import creates and selects a new notebook with the same line values,
  // and the original notebook stays in the sidebar.
  await expect(activeTitle).toHaveText(EXPORT_TITLE);
  await expect.poll(() => lineValues(page)).toEqual(REORDERED_LINES);
  await expect(sidebar.getByRole("button", { name: EXPORT_TITLE, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(sidebar.getByRole("button", { name: TITLE, exact: true })).toBeVisible();
});
