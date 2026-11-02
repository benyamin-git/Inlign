import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const THEMES = [
  { label: "Light", value: "light", themeColor: "#fffbfe" },
  { label: "Dark", value: "dark", themeColor: "#1c1b1f" },
  { label: "OLED", value: "oled", themeColor: "#000000" },
] as const;

const ACCENTS = [
  { label: "Blue", value: "blue" },
  { label: "Teal", value: "teal" },
  { label: "Green", value: "green" },
  { label: "Orange", value: "orange" },
  { label: "Rose", value: "rose" },
  { label: "Violet", value: "violet" },
] as const;

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });

  await expect(dialog).toBeVisible();

  return dialog;
}

test("opens from the top bar, closes with Done and Escape, and returns focus", async ({ page }) => {
  await page.goto("/");

  const opener = page.getByRole("button", { name: "Settings" });

  await expect(opener).toBeEnabled();
  await expect(opener).toHaveAttribute("aria-haspopup", "dialog");

  let dialog = await openSettings(page);

  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  dialog = await openSettings(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

for (const theme of THEMES) {
  test(`choosing the ${theme.label} theme applies, reloads and stays selected`, async ({
    page,
  }) => {
    await page.goto("/");

    let dialog = await openSettings(page);
    const radio = dialog.getByRole("radio", { name: theme.label });

    await radio.check({ force: true });

    await expect(page.locator("html")).toHaveAttribute("data-theme", theme.value);
    await expect(radio).toBeChecked();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      theme.themeColor,
    );

    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-theme", theme.value);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      theme.themeColor,
    );

    dialog = await openSettings(page);

    await expect(dialog.getByRole("radio", { name: theme.label })).toBeChecked();
  });
}

for (const accent of ACCENTS) {
  test(`choosing the ${accent.label} accent applies, reloads and stays selected`, async ({
    page,
  }) => {
    await page.goto("/");

    let dialog = await openSettings(page);

    // Pin Light first so the reload assertion cannot depend on the OS preference.
    await dialog.getByRole("radio", { name: "Light" }).check({ force: true });

    const radio = dialog.getByRole("radio", { name: accent.label });

    await radio.check({ force: true });

    await expect(page.locator("html")).toHaveAttribute("data-accent", accent.value);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(radio).toBeChecked();

    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-accent", accent.value);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    dialog = await openSettings(page);

    await expect(dialog.getByRole("radio", { name: "Light" })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: accent.label })).toBeChecked();
  });
}
