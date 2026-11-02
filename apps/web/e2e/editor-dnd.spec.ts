import { expect, test, type Page } from "@playwright/test";

async function lineValues(page: Page): Promise<string[]> {
  const lines = await page.getByRole("textbox").all();

  return Promise.all(lines.map((line) => line.inputValue()));
}

test("reorders cards with the pointer and the keyboard, and persists it", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("main").getByRole("button", { name: "New notebook" }).click();

  const first = page.getByRole("textbox", { name: "Line 1" });

  await expect(first).toBeFocused();
  await first.fill("alpha");
  await first.press("Enter");
  await page.keyboard.type("beta");
  await page.keyboard.press("Enter");
  await page.keyboard.type("gamma");

  await expect.poll(() => lineValues(page)).toEqual(["alpha", "beta", "gamma"]);

  // Pointer drag: line 1 onto line 3. dnd-kit only listens to pointer events,
  // so this moves the real mouse instead of using HTML5 drag helpers.
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
  // Cross the 4 px activation distance, then travel to the third card.
  await page.mouse.move(start.x, start.y + 12, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();

  await expect.poll(() => lineValues(page)).toEqual(["beta", "gamma", "alpha"]);
  // Focus goes back to the activator, which now names line 3.
  await expect(page.getByRole("button", { name: "Move line 3" })).toBeFocused();

  // Keyboard reorder: pick up alpha, move one position up, drop it. The live
  // region proves the moved-over state before the drop key is sent.
  // The sidebar has its own drag context and live region; keep this scoped to
  // the editor.
  const liveRegion = page.getByRole("main").locator("[aria-live]").first();

  await page.keyboard.press("Space");
  // dnd-kit attaches the arrow-key listener in a timer after pick-up, so wait
  // for the pick-up announcement and then one settle tick before moving.
  await expect.poll(() => liveRegion.textContent()).toContain("Line 3 is over position 3 of 3.");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => liveRegion.textContent()).toContain("Line 3 is over position 2 of 3.");
  await page.keyboard.press("Space");

  await expect.poll(() => lineValues(page)).toEqual(["beta", "alpha", "gamma"]);
  await expect(page.getByRole("button", { name: "Move line 2" })).toBeFocused();

  // Escape cancels a keyboard drag and writes nothing.
  await page.keyboard.press("Space");
  await expect.poll(() => liveRegion.textContent()).toContain("Line 2 is over position 2 of 3.");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => liveRegion.textContent()).toContain("Line 2 is over position 3 of 3.");
  await page.keyboard.press("Escape");
  await expect.poll(() => liveRegion.textContent()).toContain("Drag cancelled.");
  await expect.poll(() => lineValues(page)).toEqual(["beta", "alpha", "gamma"]);

  // Writes are immediate for structure changes, but IndexedDB is async.
  await page.waitForTimeout(300);
  await page.reload();

  await expect.poll(() => lineValues(page)).toEqual(["beta", "alpha", "gamma"]);
});
