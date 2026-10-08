import { expect, test } from '@playwright/test'

test('the seeded conflict offers a fix that clears and survives a reload', async ({ page }) => {
  await page.goto('/')

  const fix = page.locator('button.cm-ann-fix')
  await expect(fix).toHaveCount(1)
  await expect(fix).toHaveText('≠ 2.019')

  await fix.click()

  const editor = page.getByRole('textbox', { name: 'Notebook editor' })
  await expect(editor).toContainText('t = 2.019')
  await expect(fix).toHaveCount(0)

  await expect(page.getByRole('status')).toHaveText('Saved')
  await page.reload()

  await expect(page.getByRole('textbox', { name: 'Notebook editor' })).toContainText('t = 2.019')
  await expect(page.locator('button.cm-ann-fix')).toHaveCount(0)
})
