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
