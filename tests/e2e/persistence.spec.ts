import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('typed content survives a reload', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Notebook editor' })
  await expect(editor).toContainText('t = sqrt(2 * h / g)')

  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('persist = 12345')

  await expect(page.getByRole('status')).toHaveText('Saved')

  await page.reload()
  const editorAfterReload = page.getByRole('textbox', { name: 'Notebook editor' })
  await editorAfterReload.click()
  await page.keyboard.press('Control+End')
  await expect(editorAfterReload).toContainText('persist = 12345')
})

test('backup export produces a downloadable JSON file', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('textbox', { name: 'Notebook editor' })).toContainText('h = 20')

  await page.getByRole('button', { name: 'Settings' }).click()
  const sheet = page.getByRole('dialog', { name: 'Settings' })

  const downloadPromise = page.waitForEvent('download')
  await sheet.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/^inlign-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backupPath = await download.path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8')) as {
    schemaVersion: number
    notebooks: Array<{ content: string }>
  }
  expect(backup.schemaVersion).toBe(1)
  expect(backup.notebooks.length).toBeGreaterThan(0)
  expect(backup.notebooks.some((notebook) => notebook.content.includes('h = 20'))).toBe(true)
})
