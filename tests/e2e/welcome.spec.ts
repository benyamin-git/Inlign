import { expect, test } from '@playwright/test'

test('first run seeds and shows the Welcome notebook', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByLabel('Notebook title')).toHaveValue('Welcome')
  const editor = page.getByRole('textbox', { name: 'Notebook editor' })
  await expect(editor).toContainText('t = sqrt(2 * h / g)')
  await expect(editor).toContainText('v = 19.8')
})
