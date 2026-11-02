import { expect, test } from "@playwright/test";

const TITLE = "Offline notebook";
const LINE_TEXT = "saved before going offline";

test("a saved notebook reloads offline from the precached app shell and IndexedDB", async ({
  context,
  page,
}) => {
  await page.goto("/");

  const sidebar = page.getByRole("complementary", { name: "Notebooks" });

  await sidebar.getByRole("button", { name: "New notebook" }).click();
  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const titleInput = page.getByRole("textbox", { name: "Notebook title" });

  await titleInput.fill(TITLE);
  await titleInput.press("Enter");
  await expect(page.getByTestId("active-title")).toHaveText(TITLE);

  await page.getByRole("textbox", { name: "Line 1" }).fill(LINE_TEXT);

  // Cover the 400 ms trailing debounce so the line is in IndexedDB before the
  // service worker and offline reload work begins.
  await page.waitForTimeout(500);

  // The worker is generated with skipWaiting/clientsClaim, but the very first
  // page may finish loading before it is claimed. Wait for an active worker,
  // then reload once online if this page is still uncontrolled so the reload is
  // served through the worker.
  await page.evaluate("navigator.serviceWorker.ready.then(() => undefined)");

  const controlled = await page.evaluate<boolean>("navigator.serviceWorker.controller !== null");

  if (!controlled) {
    await page.reload();
  }

  await page.waitForFunction("navigator.serviceWorker.controller !== null");

  try {
    await context.setOffline(true);
    await page.reload();

    // The shell comes from the precache; the notebook and its line come from
    // IndexedDB. No network request is available at this point.
    await expect(page.getByTestId("active-title")).toHaveText(TITLE);
    await expect(page.getByRole("textbox", { name: "Line 1" })).toHaveValue(LINE_TEXT);
    await expect(sidebar.getByRole("button", { name: TITLE, exact: true })).toBeVisible();
    expect(await page.evaluate<boolean>("navigator.onLine === false")).toBe(true);
  } finally {
    await context.setOffline(false);
  }
});
