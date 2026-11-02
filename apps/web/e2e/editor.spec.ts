import { expect, test } from "@playwright/test";

test("types, splits, merges and reloads line cards", async ({ page }) => {
  await page.goto("/");

  const main = page.getByRole("main");

  await main.getByRole("button", { name: "New notebook" }).click();

  const first = page.getByRole("textbox", { name: "Line 1" });

  await expect(first).toBeFocused();
  await first.fill("alpha");
  await first.press("Enter");

  const second = page.getByRole("textbox", { name: "Line 2" });

  await expect(second).toBeFocused();
  await page.keyboard.type("beta");
  await expect(first).toHaveValue("alpha");
  await expect(second).toHaveValue("beta");

  // Backspace at the start of the second card merges it into the first.
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");

  await expect(page.getByRole("textbox")).toHaveCount(1);
  await expect(first).toHaveValue("alphabeta");
  await expect(first).toBeFocused();

  // The merge writes immediately; give the IndexedDB write time to settle.
  await page.waitForTimeout(300);
  await page.reload();

  await expect(page.getByRole("textbox", { name: "Line 1" })).toHaveValue("alphabeta");
});

test.describe("mobile card layout", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("centers the line text and drag grip on the card", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("main").getByRole("button", { name: "New notebook" }).click();

    const text = page.getByRole("textbox", { name: "Line 1" });
    const card = page.locator("li[data-line-id]");
    const grip = page.locator("[data-line-grip]");

    await text.fill("Centered");
    await expect(text).toBeVisible();

    const [cardBox, gripBox, textBox] = await Promise.all([
      card.boundingBox(),
      grip.boundingBox(),
      text.boundingBox(),
    ]);

    if (!cardBox || !gripBox || !textBox) {
      throw new Error("The line card is not laid out");
    }

    const center = (box: { y: number; height: number }) => box.y + box.height / 2;

    expect(Math.abs(center(cardBox) - center(textBox))).toBeLessThanOrEqual(1);
    expect(Math.abs(center(gripBox) - center(textBox))).toBeLessThanOrEqual(1);
  });
});
