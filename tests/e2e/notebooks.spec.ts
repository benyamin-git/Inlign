import { expect, test } from '@playwright/test'

test('creates, switches, renames, and deletes notebooks', async ({ page }) => {
  await page.goto('/')
  const title = page.getByLabel('Notebook title')
  await expect(title).toHaveValue('Welcome')

  const switcher = page.getByRole('dialog', { name: 'Notebooks' })

  await page.getByRole('button', { name: 'Notebooks' }).click()
  await switcher.getByRole('button', { name: 'New notebook' }).click()
  await expect(title).toHaveValue('Untitled')

  await page.getByRole('button', { name: 'Notebooks' }).click()
  await switcher.getByRole('button', { name: /^Welcome/ }).click()
  await expect(title).toHaveValue('Welcome')

  await page.getByRole('button', { name: 'Notebooks' }).click()
  await switcher.getByRole('button', { name: 'Rename Untitled' }).click()
  await switcher.getByLabel('Notebook name').fill('Practice')
  await switcher.getByRole('button', { name: 'Save name' }).click()
  await expect(switcher.getByText('Practice')).toBeVisible()

  await switcher.getByRole('button', { name: 'Delete Practice' }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete notebook?' })
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(switcher.getByText('Practice')).toHaveCount(0)
  await expect(title).toHaveValue('Welcome')
})
