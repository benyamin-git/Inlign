import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

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

/** Click the visible label text so label wiring and target size are exercised. */
async function choose(dialog: Locator, label: string) {
  await dialog.getByText(label, { exact: true }).click();
}

async function readStoredSettings(page: Page): Promise<Record<string, unknown>> {
  // Evaluate a string so the e2e project does not need DOM lib types.
  return await page.evaluate<Record<string, unknown>>(`new Promise((resolve, reject) => {
    const open = indexedDB.open("inlign");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction("settings", "readonly").objectStore("settings").getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve(Object.fromEntries(request.result.map((row) => [row.key, row.value])));
    };
  })`);
}

test("opens from the top bar, closes with Done, Escape and the scrim, and returns focus", async ({
  page,
}) => {
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

  dialog = await openSettings(page);
  await page.mouse.click(8, 8);
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test.describe("first run", () => {
  test.use({ colorScheme: "light" });

  test("clicking the pre-checked resolved theme pins it in the mirror and Dexie", async ({
    page,
  }) => {
    await page.goto("/");

    const dialog = await openSettings(page);
    const light = dialog.getByRole("radio", { name: "Light" });

    await expect(light).toBeChecked();
    expect(await page.evaluate('localStorage.getItem("inlign.theme")')).toBeNull();

    await choose(dialog, "Light");

    expect(await page.evaluate('localStorage.getItem("inlign.theme")')).toBe("light");
    await expect.poll(async () => (await readStoredSettings(page)).theme).toBe("light");

    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    const reopened = await openSettings(page);

    await expect(reopened.getByRole("radio", { name: "Light" })).toBeChecked();
  });
});

for (const theme of THEMES) {
  test(`choosing the ${theme.label} theme applies, reloads and stays selected`, async ({
    page,
  }) => {
    await page.goto("/");

    let dialog = await openSettings(page);
    const radio = dialog.getByRole("radio", { name: theme.label });

    await choose(dialog, theme.label);

    await expect(page.locator("html")).toHaveAttribute("data-theme", theme.value);
    await expect(radio).toBeChecked();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      theme.themeColor,
    );

    if (theme.value === "light") {
      expect(await page.evaluate('localStorage.getItem("inlign.theme")')).toBe("light");
    }

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
    await choose(dialog, "Light");

    const radio = dialog.getByRole("radio", { name: accent.label });

    await choose(dialog, accent.label);

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

test.describe("narrow portrait", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the settings panel usable", async ({ page }) => {
    await page.goto("/");

    const dialog = await openSettings(page);

    await expect(dialog.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Done" })).toBeVisible();

    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("narrow data grid", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("lays out the transfer actions as equal outlined cards", async ({ page }) => {
    await page.goto("/");

    const dialog = await openSettings(page);
    const names = ["Export active", "Import .inlign", "Export backup", "Import backup"];
    const boxes: { x: number; y: number; width: number; height: number }[] = [];

    for (const name of names) {
      const button = dialog.getByRole("button", { name, exact: true });

      await expect(button).toBeVisible();
      await expect(button).toHaveCSS("border-top-style", "solid");
      await expect(button).toHaveCSS("border-top-width", "1px");

      const fits = await button.evaluate((element) => {
        const { scrollWidth, clientWidth } = element as unknown as {
          scrollWidth: number;
          clientWidth: number;
        };

        return scrollWidth <= clientWidth + 1;
      });

      expect(fits).toBe(true);

      const box = await button.boundingBox();

      if (!box) {
        throw new Error(`${name} is not laid out`);
      }

      boxes.push(box);
    }

    const [active, importInlign, backup, importBackup] = boxes;

    if (!active || !importInlign || !backup || !importBackup) {
      throw new Error("The transfer grid is not laid out");
    }

    expect(Math.abs(active.y - importInlign.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(backup.y - importBackup.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(active.x - backup.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(importInlign.x - importBackup.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(active.width - importInlign.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(active.width - backup.width)).toBeLessThanOrEqual(1);
    expect(backup.y).toBeGreaterThan(active.y);
    expect(active.width).toBeGreaterThan(120);
    expect(active.height).toBeGreaterThanOrEqual(48);
  });
});

test.describe("short landscape", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("keeps the title and actions inside the viewport", async ({ page }) => {
    await page.goto("/");

    const dialog = await openSettings(page);
    const heading = dialog.getByRole("heading", { name: "Settings" });
    const done = dialog.getByRole("button", { name: "Done" });

    await expect(heading).toBeVisible();
    await expect(done).toBeVisible();

    const headingBox = await heading.boundingBox();
    const doneBox = await done.boundingBox();

    if (!headingBox || !doneBox) {
      throw new Error("Settings panel is not laid out");
    }

    expect(headingBox.y).toBeGreaterThanOrEqual(0);
    expect(doneBox.y + doneBox.height).toBeLessThanOrEqual(390);

    await done.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Settings" })).toBeFocused();
  });
});
