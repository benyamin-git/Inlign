import { expect, test } from "@playwright/test";

test("shows the first-run shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "No notebooks yet" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "New notebook" })).toBeVisible();
  await expect(page.getByTestId("active-title")).toHaveText("");
  await expect(page.getByRole("button", { name: "Settings" })).toBeEnabled();
});
