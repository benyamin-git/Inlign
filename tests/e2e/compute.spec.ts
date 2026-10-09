import { expect, test } from '@playwright/test'

test('typing a formula shows its result within two seconds', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Notebook editor' })
  await expect(editor).toContainText('h = 20')

  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('3 + 4')

  await expect(page.locator('.cm-ann-result', { hasText: /^= 7$/ })).toBeVisible({
    timeout: 2000,
  })
})

test('shows a result only on the line with the caret', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Notebook editor' })
  const tResult = page.locator('.cm-ann-result', { hasText: /^= 2\.01927510938$/ })
  await expect(editor).toContainText('t = sqrt(2 * h / g)')

  await expect(tResult).toHaveCount(0)

  await editor.getByText('t = sqrt(2 * h / g)').click()
  await expect(tResult).toBeVisible()

  await editor.getByText(/^h = 20$/).click()
  await expect(tResult).toHaveCount(0)
})
