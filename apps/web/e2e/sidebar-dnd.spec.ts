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

async function titleCenter(page: Page, title: string): Promise<{ x: number; y: number }> {
  const box = await sidebar(page).getByRole("button", { name: title, exact: true }).boundingBox();

  if (!box) {
    throw new Error(`Notebook title ${title} is not visible.`);
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// dnd-kit listens to mouse events, so move the real mouse rather than using
// HTML5 drag helpers. The title button is the activator.
async function pointerDrag(page: Page, sourceTitle: string, targetTitle: string): Promise<void> {
  const start = await titleCenter(page, sourceTitle);
  const end = await titleCenter(page, targetTitle);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // Cross the 8 px activation distance before travelling to the target.
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

  // A plain click or Enter selects a notebook without reordering it.
  const activeTitle = page.getByTestId("active-title");

  await sidebar(page).getByRole("button", { name: "Alpha", exact: true }).click();
  await expect(activeTitle).toHaveText("Alpha");
  await sidebar(page).getByRole("button", { name: "Beta", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(activeTitle).toHaveText("Beta");
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

  // Both orders and the pin survive a reload; the assertions above already
  // wait for the persisted refresh.
  await page.reload();

  await expect(sidebar(page).getByRole("heading", { name: "Pinned", exact: true })).toBeVisible();
  await expect.poll(() => sectionOrder(page, "pinned")).toEqual(["Alpha"]);
  await expect.poll(() => sectionOrder(page, "unpinned")).toEqual(["Beta", "Gamma"]);
  await expect.poll(() => titleOrder(page)).toEqual(["Alpha", "Beta", "Gamma"]);
});

test.describe("touch drag", () => {
  test.use({ hasTouch: true });

  test("reorders after a hold and persists", async ({ page, context }) => {
    await page.goto("/");
    await createNotebook(page, "One");
    await createNotebook(page, "Two");
    await createNotebook(page, "Three");

    await expect.poll(() => titleOrder(page)).toEqual(["Three", "Two", "One"]);

    const session = await context.newCDPSession(page);
    const start = await titleCenter(page, "Three");
    const end = await titleCenter(page, "One");
    const point = (x: number, y: number) => [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }];

    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: point(start.x, start.y),
    });
    // Hold still past TouchSensor's 200 ms delay. This is the behaviour the
    // mouse sensor split protects: a touch gesture must stay with TouchSensor.
    await page.waitForTimeout(300);

    // Move in several steps so dnd-kit sees a real drag, not a jump.
    for (let step = 1; step <= 10; step += 1) {
      const x = start.x + ((end.x - start.x) * step) / 10;
      const y = start.y + ((end.y - start.y) * step) / 10;

      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: point(x, y),
      });
      await page.waitForTimeout(16);
    }

    await page.waitForTimeout(100);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect.poll(() => titleOrder(page)).toEqual(["Two", "One", "Three"]);

    await page.reload();
    await expect.poll(() => titleOrder(page)).toEqual(["Two", "One", "Three"]);
  });
});
