import { expect, test, type Locator, type Page } from "@playwright/test";

function sidebar(page: Page): Locator {
  return page.getByRole("complementary", { name: "Notebooks" });
}

async function createNotebook(page: Page, title: string): Promise<void> {
  const list = sidebar(page);

  await list.getByRole("button", { name: "New notebook" }).click();
  await list.getByRole("button", { name: "Actions for Untitled" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const input = page.getByRole("textbox", { name: "Notebook title" });

  await expect(input).toBeFocused();
  await input.fill(title);
  await input.press("Enter");
  await expect(list.getByRole("button", { name: title, exact: true })).toBeVisible();
}

async function labelsOf(titles: Locator): Promise<string[]> {
  const elements = await titles.all();
  const labels = await Promise.all(elements.map((element) => element.getAttribute("aria-label")));

  return labels.map((label) => label ?? "");
}

async function titleOrder(page: Page): Promise<string[]> {
  return labelsOf(sidebar(page).locator("[data-notebook-title-id]"));
}

async function sectionOrder(page: Page, section: "pinned" | "unpinned"): Promise<string[]> {
  return labelsOf(
    sidebar(page).locator(`[data-notebook-section="${section}"] [data-notebook-title-id]`),
  );
}

// dnd-kit listens to pointer events, so move the real mouse rather than using
// HTML5 drag helpers. The title button is the activator.
async function pointerDrag(page: Page, sourceTitle: string, targetTitle: string): Promise<void> {
  const sourceBox = await sidebar(page)
    .getByRole("button", { name: sourceTitle, exact: true })
    .boundingBox();
  const targetBox = await sidebar(page)
    .getByRole("button", { name: targetTitle, exact: true })
    .boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("Notebook titles are not visible.");
  }

  const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  const end = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // Cross the 4 px activation distance before travelling to the target.
  await page.mouse.move(start.x, start.y + 12, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

test("reorders within a section with pointer and keyboard, pins from the menu, and persists", async ({
  page,
}) => {
  await page.goto("/");
  await createNotebook(page, "Alpha");
  await createNotebook(page, "Beta");
  await createNotebook(page, "Gamma");

  // New notebooks go to the top of the unpinned section.
  await expect.poll(() => titleOrder(page)).toEqual(["Gamma", "Beta", "Alpha"]);

  // Pointer drag: Gamma to the bottom.
  await pointerDrag(page, "Gamma", "Alpha");
  await expect.poll(() => titleOrder(page)).toEqual(["Beta", "Alpha", "Gamma"]);
  await expect(sidebar(page).getByRole("button", { name: "Gamma", exact: true })).toBeFocused();

  // Keyboard drag: Space picks up, arrows move, Space drops.
  const liveRegion = sidebar(page).locator("[aria-live]").first();

  await page.keyboard.press("Space");
  // The pick-up announcement is replaced by the over position in the same
  // tick, so the over message proves the drag is active.
  await expect.poll(() => liveRegion.textContent()).toContain("Gamma is over position 3 of 3.");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => liveRegion.textContent()).toContain("Gamma is over position 2 of 3.");
  await page.keyboard.press("Space");

  await expect.poll(() => titleOrder(page)).toEqual(["Beta", "Gamma", "Alpha"]);
  await expect(sidebar(page).getByRole("button", { name: "Gamma", exact: true })).toBeFocused();

  // Escape cancels the next keyboard drag and writes nothing.
  await page.keyboard.press("Space");
  await expect.poll(() => liveRegion.textContent()).toContain("Gamma is over position 2 of 3.");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => liveRegion.textContent()).toContain("Gamma is over position 3 of 3.");
  await page.keyboard.press("Escape");
  await expect.poll(() => liveRegion.textContent()).toContain("Drag cancelled.");
  await expect.poll(() => titleOrder(page)).toEqual(["Beta", "Gamma", "Alpha"]);
  await expect(sidebar(page).getByRole("button", { name: "Gamma", exact: true })).toBeFocused();

  // Pin the last notebook from its menu. It moves to the top of the pinned
  // section; the unpinned order stays as it was.
  await sidebar(page).getByRole("button", { name: "Actions for Alpha" }).click();
  await page.getByRole("menuitem", { name: "Pin notebook" }).click();

  await expect(sidebar(page).getByRole("heading", { name: "Pinned", exact: true })).toBeVisible();
  await expect.poll(() => sectionOrder(page, "pinned")).toEqual(["Alpha"]);
  await expect.poll(() => sectionOrder(page, "unpinned")).toEqual(["Beta", "Gamma"]);
  await expect.poll(() => titleOrder(page)).toEqual(["Alpha", "Beta", "Gamma"]);
  await expect(sidebar(page).getByRole("button", { name: "Alpha", exact: true })).toBeFocused();

  // Both orders and the pin survive a reload.
  await page.waitForTimeout(300);
  await page.reload();

  await expect(sidebar(page).getByRole("heading", { name: "Pinned", exact: true })).toBeVisible();
  await expect.poll(() => sectionOrder(page, "pinned")).toEqual(["Alpha"]);
  await expect.poll(() => sectionOrder(page, "unpinned")).toEqual(["Beta", "Gamma"]);
  await expect.poll(() => titleOrder(page)).toEqual(["Alpha", "Beta", "Gamma"]);
});
