#!/usr/bin/env node
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Rasterizes public/favicon.svg into the PWA icon set with headless Chromium.
// The maskable variants full-bleed the brand color and keep the monogram
// inside the maskable safe zone (80% of the icon), so launchers can crop any
// shape without losing the mark. Same input, same browser, same pixels: the
// committed PNGs must be byte-stable across runs.

const BRAND_BLUE = '#35639c'
const SIZES = [192, 512]
const MASKABLE_SCALE = 0.8
const OUTPUT_DIR = fileURLToPath(new URL('../public/icons/', import.meta.url))

const favicon = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const faviconDataUrl = `data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}`

function renderHtml(size, maskable) {
  const imageSize = Math.round(size * (maskable ? MASKABLE_SCALE : 1))
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
      body {
        display: grid;
        place-items: center;
        background: ${maskable ? BRAND_BLUE : 'transparent'};
      }
      img { display: block; width: ${imageSize}px; height: ${imageSize}px; }
    </style>
  </head>
  <body><img src="${faviconDataUrl}" alt="" /></body>
</html>
`
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const size of SIZES) {
      for (const [name, maskable] of [
        [`icon-${size}.png`, false],
        [`icon-maskable-${size}.png`, true],
      ]) {
        const page = await browser.newPage({
          viewport: { width: size, height: size },
          deviceScaleFactor: 1,
        })
        await page.setContent(renderHtml(size, maskable), { waitUntil: 'load' })
        await page.screenshot({
          path: join(OUTPUT_DIR, name),
          omitBackground: !maskable,
        })
        await page.close()
        console.log(`wrote public/icons/${name}`)
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
