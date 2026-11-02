import { expect, test, type Page } from "@playwright/test";

async function createNotebook(page: Page, title: string): Promise<void> {
  const sidebar = page.getByRole("complementary", { name: "Notebooks" });

  await sidebar.getByRole("button", { name: "New notebook" }).click();
  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const input = page.getByRole("textbox", { name: "Notebook title" });

  await expect(input).toBeFocused();
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByTestId("active-title")).toHaveText(title);
}

test("typed text survives a reload after the autosave debounce", async ({ page }) => {
  await page.goto("/");
  await createNotebook(page, "Persist Reload");

  const line = page.getByRole("textbox", { name: "Line 1" });

  await line.fill("autosaved across reload");

  // Cover the 400 ms trailing debounce. This reload exercises the debounced
  // write itself rather than the page-hide flush.
  await page.waitForTimeout(500);
  await page.reload();

  await expect(page.getByRole("textbox", { name: "Line 1" })).toHaveValue(
    "autosaved across reload",
  );
});

test("switching notebooks mid-burst flushes pending text", async ({ page }) => {
  await page.goto("/");
  await createNotebook(page, "Persist One");
  await createNotebook(page, "Persist Two");

  const sidebar = page.getByRole("complementary", { name: "Notebooks" });
  const activeTitle = page.getByTestId("active-title");

  await sidebar.getByRole("button", { name: "Persist One", exact: true }).click();
  await expect(activeTitle).toHaveText("Persist One");

  const line = page.getByRole("textbox", { name: "Line 1" });

  await expect(line).toBeFocused();
  await line.fill("flushed by switching");

  // Switch well inside the 400 ms debounce. The editor unmount flushes text
  // before the other notebook mounts.
  await sidebar.getByRole("button", { name: "Persist Two", exact: true }).click();
  await expect(activeTitle).toHaveText("Persist Two");

  await sidebar.getByRole("button", { name: "Persist One", exact: true }).click();
  await expect(activeTitle).toHaveText("Persist One");
  await expect(page.getByRole("textbox", { name: "Line 1" })).toHaveValue("flushed by switching");
});
