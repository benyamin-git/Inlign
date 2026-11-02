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

  // Writes happen on every change for now; give the last one time to settle.
  await page.waitForTimeout(300);
  await page.reload();

  await expect(page.getByRole("textbox", { name: "Line 1" })).toHaveValue("alphabeta");
});
