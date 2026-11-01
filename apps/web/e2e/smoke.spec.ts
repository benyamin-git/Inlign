import { expect, test } from "@playwright/test";

test("shows the engine version reported by the worker", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("engine-version")).toHaveText(/^\d+\.\d+\.\d+$/);
});
