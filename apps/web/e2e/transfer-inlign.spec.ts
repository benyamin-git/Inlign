import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("exports a notebook and imports it back as a new one", async ({ page }) => {
  await page.goto("/");

  const main = page.getByRole("main");
  const sidebar = page.getByRole("complementary", { name: "Notebooks" });
  const activeTitle = page.getByTestId("active-title");
  const stamp = Date.now();
  const title = `Transfer round trip ${String(stamp)}`;
  const importedTitle = `transfer-round-trip-${String(stamp)}`;

  // Create and rename a notebook so the filename is predictable.
  await main.getByRole("button", { name: "New notebook" }).click();
  await expect(activeTitle).toHaveText("Untitled");

  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const titleInput = page.getByRole("textbox", { name: "Notebook title" });

  await titleInput.fill(title);
  await titleInput.press("Enter");
  await expect(activeTitle).toHaveText(title);

  // Two logical lines, which serialize as two newline-separated lines.
  const firstLine = page.getByRole("textbox", { name: "Line 1" });

  await firstLine.fill("first line");
  await firstLine.press("Enter");

  const secondLine = page.getByRole("textbox", { name: "Line 2" });

  await expect(secondLine).toBeFocused();
  await secondLine.fill("second line");
  await expect(secondLine).toHaveValue("second line");

  const downloadPromise = page.waitForEvent("download");

  await sidebar.getByRole("button", { name: `Actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Export .inlign" }).click();

  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(`${importedTitle}.inlign`);

  const path = await download.path();

  if (!path) {
    throw new Error("The export download has no local path");
  }

  const bytes = await readFile(path);

  expect(bytes.toString("utf8")).toBe("first line\nsecond line");

  // Import the same bytes and filename through the settings Data section.
  await page.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });

  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "text/plain",
    buffer: bytes,
  });

  await expect(activeTitle).toHaveText(importedTitle);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  // The import creates and selects a second notebook with the same lines.
  await expect(activeTitle).toHaveText(importedTitle);
  await expect(page.getByRole("textbox", { name: "Line 1" })).toHaveValue("first line");
  await expect(page.getByRole("textbox", { name: "Line 2" })).toHaveValue("second line");
  await expect(sidebar.getByRole("button", { name: title, exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: importedTitle, exact: true })).toBeVisible();
});
