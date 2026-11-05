import { expect, test, type Locator, type Page } from "@playwright/test";

function line(page: Page, n: number): Locator {
  return page
    .locator("li[data-line-id]")
    .filter({ has: page.getByRole("textbox", { name: `Line ${String(n)}` }) });
}

function suggestion(page: Page, n: number): Locator {
  return line(page, n).locator("[data-line-annotation='suggestion']");
}

function errorMark(page: Page, n: number): Locator {
  return line(page, n).locator("[data-line-annotation='error']");
}

async function newNotebook(page: Page, texts: string[]): Promise<void> {
  const mainNew = page.getByRole("main").getByRole("button", { name: "New notebook" });
  const sidebarNew = page
    .getByRole("complementary", { name: "Notebooks" })
    .getByRole("button", { name: "New notebook" });

  if (await mainNew.isVisible()) {
    await mainNew.click();
  } else {
    await sidebarNew.click();
  }

  let current = page.getByRole("textbox", { name: "Line 1" });

  await expect(current).toBeFocused();
  await current.fill(texts[0] ?? "");

  for (let index = 1; index < texts.length; index += 1) {
    await current.press("End");
    await current.press("Enter");
    current = page.getByRole("textbox", { name: `Line ${String(index + 1)}` });
    await expect(current).toBeFocused();
    await current.fill(texts[index] ?? "");
  }

  await current.press("End");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
});

test("computes the exact example and keeps the accepted value after reload", async ({ page }) => {
  await newNotebook(page, ["f = m × a", "f = 10", "m = 2", "a = "]);

  const last = page.getByRole("textbox", { name: "Line 4" });
  const ghost = suggestion(page, 4);

  await expect(last).toBeFocused();
  await expect(ghost).toHaveText("5");

  await last.press("Tab");
  await expect(last).toHaveValue("a = 5");
  await expect(ghost).toHaveCount(0);

  await page.waitForTimeout(600);
  await page.reload();

  await expect(page.getByRole("textbox", { name: "Line 4" })).toHaveValue("a = 5");
});

test("a dot between names multiplies them", async ({ page }) => {
  await newNotebook(page, ["x = 2", "y = 3", "a = x.y", "a = "]);

  await expect(line(page, 3)).toHaveAttribute("data-engine-status", "ok");
  await expect(suggestion(page, 4)).toHaveText("6");
});

test("a formula after its values fills only later incomplete lines", async ({ page }) => {
  await newNotebook(page, ["f = 10", "m = 2", "a = ", "f = m × a"]);

  await expect(line(page, 3)).toHaveAttribute("data-engine-status", "incomplete");
  await expect(suggestion(page, 3)).toHaveCount(0);

  const fourth = page.getByRole("textbox", { name: "Line 4" });
  await fourth.press("End");
  await fourth.press("Enter");

  const fifth = page.getByRole("textbox", { name: "Line 5" });
  await expect(fifth).toBeFocused();
  await fifth.fill("a = ");
  await fifth.press("End");

  await expect(suggestion(page, 5)).toHaveText("5");
});

test("an incomplete line is not an error and evaluation continues", async ({ page }) => {
  await newNotebook(page, ["a = 2 +", "b = 3", "b = "]);

  await expect(line(page, 1)).toHaveAttribute("data-engine-status", "incomplete");
  await expect(errorMark(page, 1)).toHaveCount(0);
  await expect(line(page, 2)).toHaveAttribute("data-engine-status", "ok");
  await expect(suggestion(page, 3)).toHaveText("3");
});

test("a conflict keeps the first value, dims later lines and recovers", async ({ page }) => {
  await newNotebook(page, ["a = 5", "a = 6", "b = a + 1"]);

  await expect(line(page, 2)).toHaveAttribute("data-engine-status", "error");
  await expect(errorMark(page, 2)).toHaveText("a = 5");
  await expect(line(page, 3)).toHaveAttribute("data-engine-status", "skipped");

  await page.getByRole("textbox", { name: "Line 2" }).fill("a = 5");

  await expect(line(page, 2)).toHaveAttribute("data-engine-status", "ok");
  await expect(errorMark(page, 2)).toHaveCount(0);
  await expect(line(page, 3)).toHaveAttribute("data-engine-status", "ok");
});

test("a false equality is an error", async ({ page }) => {
  await newNotebook(page, ["1 = 2"]);

  await expect(line(page, 1)).toHaveAttribute("data-engine-status", "error");
  await expect(errorMark(page, 1)).toHaveText("false");
});

test("prose and a double equals are invalid", async ({ page }) => {
  await newNotebook(page, ["hello world"]);

  await expect(line(page, 1)).toHaveAttribute("data-engine-status", "error");
  await expect(errorMark(page, 1)).toHaveText("invalid");

  await newNotebook(page, ["a == 2"]);

  await expect(line(page, 1)).toHaveAttribute("data-engine-status", "error");
  await expect(errorMark(page, 1)).toHaveText("invalid");
});

test("division by zero is an error", async ({ page }) => {
  await newNotebook(page, ["a = 1 / 0"]);

  await expect(line(page, 1)).toHaveAttribute("data-engine-status", "error");
  await expect(errorMark(page, 1)).toHaveText("÷ 0");
});

test("a quadratic shows both roots, accepts them, then narrows to a single value", async ({
  page,
}) => {
  await newNotebook(page, ["x^2 = 4", "x = "]);

  const second = page.getByRole("textbox", { name: "Line 2" });

  await expect(suggestion(page, 2)).toHaveText("±2");
  await second.press("Tab");
  await expect(second).toHaveValue("x = ±2");
  await expect(suggestion(page, 2)).toHaveCount(0);

  await second.press("End");
  await second.press("Enter");

  const third = page.getByRole("textbox", { name: "Line 3" });
  await expect(third).toBeFocused();
  await third.fill("x = 2");
  await third.press("End");
  await third.press("Enter");

  const fourth = page.getByRole("textbox", { name: "Line 4" });
  await expect(fourth).toBeFocused();
  await fourth.fill("x = ");
  await fourth.press("End");

  await expect(suggestion(page, 4)).toHaveText("2");
});

test("a non-symmetric set displays descending and inserts only the largest", async ({ page }) => {
  await newNotebook(page, ["x^2 + x = 0", "x = "]);

  const second = page.getByRole("textbox", { name: "Line 2" });

  await expect(suggestion(page, 2)).toHaveText("0, -1");
  await second.press("Tab");
  await expect(second).toHaveValue("x = 0");
  await expect(suggestion(page, 2)).toHaveCount(0);
});

test("an outside set value is a set conflict", async ({ page }) => {
  await newNotebook(page, ["x^2 = 4", "x = 3"]);

  await expect(line(page, 2)).toHaveAttribute("data-engine-status", "error");
  await expect(errorMark(page, 2)).toHaveText("x = ±2");
});

test("a second set is left valid but unsolved", async ({ page }) => {
  await newNotebook(page, ["x^2 = 4", "y = x + 1", "y = "]);

  await expect(line(page, 3)).toHaveAttribute("data-engine-status", "incomplete");
  await expect(suggestion(page, 3)).toHaveCount(0);
  await expect(errorMark(page, 3)).toHaveCount(0);
});

test("empty lines are ignored and never show errors", async ({ page }) => {
  await newNotebook(page, ["f = m × a", "", "f = 10", "", "m = 2", "", "a = "]);

  await expect(suggestion(page, 7)).toHaveText("5");

  for (const n of [2, 4, 6]) {
    await expect(line(page, n)).toHaveAttribute("data-engine-status", "empty");
    await expect(errorMark(page, n)).toHaveCount(0);
    await expect(suggestion(page, n)).toHaveCount(0);
  }
});

test.describe("mobile engine layout", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("a long error annotation wraps inside its card", async ({ page }) => {
    await newNotebook(page, ["averylongvariablename = 5", "averylongvariablename = 6", "b = 3"]);

    const mark = errorMark(page, 2);

    await expect(mark).toHaveText("averylongvariablename = 5");

    const [annotationBox, cardBox, thirdBox] = await Promise.all([
      mark.boundingBox(),
      line(page, 2).boundingBox(),
      line(page, 3).boundingBox(),
    ]);

    if (!annotationBox || !cardBox || !thirdBox) {
      throw new Error("The wrapped error card is not laid out");
    }

    expect(annotationBox.y).toBeGreaterThanOrEqual(cardBox.y);
    expect(annotationBox.y + annotationBox.height).toBeLessThanOrEqual(
      cardBox.y + cardBox.height + 1,
    );
    expect(annotationBox.y + annotationBox.height).toBeLessThanOrEqual(thirdBox.y + 1);
  });
});

test("Tab moves focus normally without a suggestion and stays after accepting one", async ({
  page,
}) => {
  await newNotebook(page, ["a = 5", "a = "]);

  const first = page.getByRole("textbox", { name: "Line 1" });
  const second = page.getByRole("textbox", { name: "Line 2" });

  await first.focus();
  await first.press("Tab");
  await expect(first).not.toBeFocused();

  await second.focus();
  await second.press("End");
  await expect(suggestion(page, 2)).toHaveText("5");

  await second.press("Tab");
  await expect(second).toHaveValue("a = 5");
  await expect(second).toBeFocused();
});

test("case-insensitive variables can be enabled for one notebook", async ({ page }) => {
  await newNotebook(page, ["X = 2", "x = "]);

  const second = page.getByRole("textbox", { name: "Line 2" });
  const sidebar = page.getByRole("complementary", { name: "Notebooks" });

  await expect(second).toBeFocused();
  await expect(line(page, 2)).toHaveAttribute("data-engine-status", "incomplete");
  await expect(suggestion(page, 2)).toHaveCount(0);

  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();

  const toggle = page.getByRole("menuitemcheckbox", { name: "Ignore variable case" });

  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();

  await second.focus();
  await second.press("End");
  await expect(suggestion(page, 2)).toHaveText("2");

  await sidebar.getByRole("button", { name: "Actions for Untitled" }).click();
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Ignore variable case" }),
  ).toHaveAttribute("aria-checked", "true");
});

test("a new notebook follows the case preference from Settings", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  const toggle = dialog.getByRole("checkbox", { name: "Ignore variable case by default" });

  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  await newNotebook(page, ["X = 2", "x = "]);

  const second = page.getByRole("textbox", { name: "Line 2" });

  await expect(second).toBeFocused();
  await expect(suggestion(page, 2)).toHaveText("2");
});

test("pressing Space twice accepts a suggestion like Tab", async ({ page }) => {
  await newNotebook(page, ["a = 5", "a ="]);

  const second = page.getByRole("textbox", { name: "Line 2" });

  await expect(second).toBeFocused();
  await expect(suggestion(page, 2)).toHaveText("5");

  await second.press("Space");
  await second.press("Space");

  await expect(second).toHaveValue("a = 5");
  await expect(suggestion(page, 2)).toHaveCount(0);
});

test("errors and suggestions expose the exact accessible descriptions", async ({ page }) => {
  await newNotebook(page, ["a = 5", "a = 6"]);

  const errorLine = page.getByRole("textbox", { name: "Line 2" });

  await expect(errorLine).toHaveAttribute("aria-invalid", "true");
  await expect(errorLine).toHaveAccessibleDescription("Error: a = 5.");

  await newNotebook(page, ["a = 5", "a = "]);

  const suggestionLine = page.getByRole("textbox", { name: "Line 2" });

  await expect(suggestion(page, 2)).toHaveText("5");
  await expect(suggestionLine).toHaveAccessibleDescription(
    "Suggestion: 5. Press Tab or Space twice to accept 5.",
  );
});
