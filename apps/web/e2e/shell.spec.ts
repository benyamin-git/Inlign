import { expect, test } from "@playwright/test";

test("creates, renames and deletes notebooks", async ({ page }) => {
  await page.goto("/");

  const main = page.getByRole("main");
  const sidebar = page.getByRole("complementary", { name: "Notebooks" });
  const activeTitle = page.getByTestId("active-title");

  await expect(main.getByRole("heading", { name: "No notebooks yet" })).toBeVisible();

  // Create from the empty state.
  await main.getByRole("button", { name: "New notebook" }).click();
  await expect(activeTitle).toHaveText("Untitled");
  await expect(sidebar.getByRole("button", { name: "Untitled", exact: true })).toBeVisible();

  // Rename inline; Enter commits.
  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const input = page.getByRole("textbox", { name: "Notebook title" });

  await expect(input).toBeFocused();
  await input.fill("Alpha");
  await input.press("Enter");
  await expect(activeTitle).toHaveText("Alpha");
  await expect(sidebar.getByRole("button", { name: "Alpha", exact: true })).toBeVisible();

  // Escape cancels without writing.
  await sidebar.getByRole("button", { name: "Actions for Alpha" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await input.fill("Beta");
  await input.press("Escape");
  await expect(activeTitle).toHaveText("Alpha");

  // A second notebook is selected and goes to the top of the list.
  await sidebar.getByRole("button", { name: "New notebook" }).click();
  await expect(activeTitle).toHaveText("Untitled");

  const items = sidebar.getByRole("button", { name: /^(Alpha|Untitled)$/ });

  await expect(items).toHaveCount(2);
  await expect(items.first()).toHaveAccessibleName("Untitled");

  // Delete asks first; Cancel keeps the notebook.
  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  const dialog = page.getByRole("dialog", { name: "Delete notebook?" });

  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Untitled", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(activeTitle).toHaveText("Untitled");

  // Delete confirms, removes the notebook and selects the remaining one.
  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(dialog).toBeHidden();
  await expect(activeTitle).toHaveText("Alpha");
  await expect(sidebar.getByRole("button", { name: "Untitled", exact: true })).toHaveCount(0);

  // The rename persists across a reload. Alpha is the only notebook left, so
  // the first notebook selected on load is Alpha.
  await page.reload();
  await expect(activeTitle).toHaveText("Alpha");
  await expect(sidebar.getByRole("button", { name: "Alpha", exact: true })).toBeVisible();
});

test.describe("narrow viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("creates from the drawer and closes it", async ({ page }) => {
    await page.goto("/");

    const drawer = page.getByRole("dialog", { name: "Notebooks" });

    await expect(drawer).toBeHidden();

    await page.getByRole("button", { name: "Show sidebar" }).click();
    await expect(drawer).toBeVisible();

    await drawer.getByRole("button", { name: "New notebook" }).click();

    await expect(drawer).toBeHidden();
    await expect(page.getByTestId("active-title")).toHaveText("Untitled");
  });
});
