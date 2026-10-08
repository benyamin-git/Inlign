import { expect, test } from '@playwright/test'

// The e2e tsconfig deliberately excludes the DOM lib; only the two service
// worker properties this spec touches are declared.
type ServiceWorkerNavigator = Navigator & {
  serviceWorker: { ready: Promise<unknown>; controller: unknown }
}

test('the app shell loads offline once the service worker is active', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByLabel('Notebook title')).toHaveValue('Welcome')

  await page.evaluate(async () => {
    await (navigator as ServiceWorkerNavigator).serviceWorker.ready
  })
  await page.waitForFunction(() => {
    return (navigator as ServiceWorkerNavigator).serviceWorker.controller !== null
  })

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByLabel('Notebook title')).toHaveValue('Welcome')
  await expect(page.getByRole('textbox', { name: 'Notebook editor' })).toContainText('h = 20')
})
