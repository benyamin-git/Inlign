#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}`
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUTPUT_DIR = fileURLToPath(new URL('../screenshots/desktop/', import.meta.url))

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function ensureBuild() {
  if (existsSync(join(ROOT, 'dist', 'index.html'))) return
  console.log('dist/ is missing — building the app before capturing screenshots.')
  run(process.execPath, ['scripts/env.mjs', 'vite', 'build'])
}

function startPreview() {
  const child = spawn(
    process.execPath,
    [
      'scripts/env.mjs',
      'vite',
      'preview',
      '--port',
      String(PORT),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk
  })
  child.stderr.on('data', (chunk) => {
    output += chunk
  })
  return { child, output: () => output }
}

async function waitForServer(preview) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL)
      if (response.ok) return
    } catch {
      // The server is still starting; keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`preview server did not start on port ${PORT}\n${preview.output()}`)
}

function stopPreview(preview) {
  const { child } = preview
  if (child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

async function waitForAutosave(page) {
  const status = page.locator('[role="status"]')
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const text = await status.textContent()
    if (text !== 'Saving…') {
      await page.waitForTimeout(600)
      if ((await status.textContent()) !== 'Saving…') return
    }
    await page.waitForTimeout(250)
  }
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.locator('.cm-ann-result', { hasText: '= 20' }).waitFor()
  await waitForAutosave(page)
}

async function capture(page, name) {
  await page.mouse.move(0, 0)
  await page.screenshot({ path: join(OUTPUT_DIR, `${name}.png`), animations: 'disabled' })
  console.log(`captured screenshots/desktop/${name}.png`)
}

async function main() {
  ensureBuild()
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const preview = startPreview()
  let browser = null
  try {
    await waitForServer(preview)
    browser = await chromium.launch()
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light',
      locale: 'en-US',
      timezoneId: 'UTC',
    })
    const page = await context.newPage()
    // Pinned so notebook timestamps and ordering in screenshots are byte-stable.
    await page.clock.setSystemTime(new Date('2026-01-15T12:00:00Z'))
    await page.goto(BASE_URL)
    await page.getByLabel('Notebook title').waitFor()
    await settle(page)

    await capture(page, 'editor')

    await page
      .locator('button.cm-ann-fix')
      .evaluate((button) => button.scrollIntoView({ block: 'center' }))
    await capture(page, 'conflict')

    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('dialog', { name: 'Settings' }).waitFor()
    await capture(page, 'settings')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Help' }).click()
    await page.getByRole('dialog', { name: 'Help' }).waitFor()
    await capture(page, 'help')
    await page.keyboard.press('Escape')

    await page.clock.setSystemTime(new Date('2026-01-15T12:05:00Z'))
    await page.getByRole('button', { name: 'New notebook' }).click()
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="Notebook title"]')?.value === 'Untitled',
    )
    await page.getByRole('button', { name: 'Notebooks' }).click()
    const switcher = page.getByRole('dialog', { name: 'Notebooks' })
    await switcher.waitFor()
    await switcher.getByRole('button', { name: 'Rename Untitled' }).click()
    await switcher.getByLabel('Notebook name').fill('Practice')
    await switcher.getByRole('button', { name: 'Save name' }).click()
    await switcher.getByText('Practice').waitFor()
    await switcher.getByRole('button', { name: /^Welcome/ }).click()
    await page.getByRole('button', { name: 'Notebooks' }).click()
    await switcher.waitFor()
    await settle(page)
    await capture(page, 'switcher')
  } finally {
    await browser?.close()
    stopPreview(preview)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
