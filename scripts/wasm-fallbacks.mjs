#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Termux/Android cannot dlopen the native N-API addons this toolchain ships,
// and npm skips the official WASI fallbacks whenever they are published with
// `cpu: wasm32`. This postinstall materializes them by hand on Android so the
// toolchain runs on its pure-wasm paths:
//
//   - @tailwindcss/oxide-wasm32-wasi for Tailwind's scanner.
//   - lightningcss-wasm, plus a small shim at node_modules/lightningcss that
//     re-exports it, because Tailwind imports the native package by name.
//
// A no-op on every other platform, where the native bindings work.
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const nodeModules = join(projectRoot, 'node_modules')

async function ensurePackage(name, version) {
  const target = join(nodeModules, ...name.split('/'))
  if (existsSync(join(target, 'package.json'))) return

  const unscoped = name.split('/').pop()
  const url = `https://registry.npmjs.org/${name}/-/${unscoped}-${version}.tgz`
  console.log(`fetching ${name}@${version} (Android WASI fallback)`)

  const work = mkdtempSync(join(tmpdir(), 'inlign-wasm-pkg-'))
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
    const tarball = join(work, 'package.tgz')
    writeFileSync(tarball, Buffer.from(await response.arrayBuffer()))
    mkdirSync(join(work, 'extract'))
    execFileSync('tar', ['-xzf', tarball, '-C', join(work, 'extract')], { stdio: 'inherit' })
    mkdirSync(target, { recursive: true })
    cpSync(join(work, 'extract', 'package'), target, { recursive: true })
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function lightningcssManifests() {
  const manifests = [join(nodeModules, 'lightningcss', 'package.json')]
  for (const entry of readdirSync(nodeModules, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      manifests.push(join(nodeModules, entry.name, 'node_modules', 'lightningcss', 'package.json'))
    }
  }
  return manifests.filter((manifest) => existsSync(manifest))
}

function ensureLightningcssShims() {
  for (const manifestPath of lightningcssManifests()) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (manifest.name === 'lightningcss-wasm') continue

    const directory = join(manifestPath, '..')
    writeFileSync(join(directory, 'index.mjs'), "export * from 'lightningcss-wasm'\n")
    writeFileSync(join(directory, 'index.cjs'), "module.exports = require('lightningcss-wasm')\n")
    writeFileSync(
      manifestPath,
      `${JSON.stringify(
        {
          name: 'lightningcss',
          version: manifest.version,
          type: 'module',
          exports: { '.': { import: './index.mjs', require: './index.cjs' } },
        },
        null,
        2,
      )}\n`,
    )
    console.log(`shimmed ${directory} onto lightningcss-wasm`)
  }
}

function dependencyVersion(manifestPath, dependency) {
  if (!existsSync(manifestPath)) return undefined
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const spec = manifest.dependencies?.[dependency]
  return typeof spec === 'string' ? spec.replace(/[^0-9.]/g, '') : undefined
}

if (process.platform === 'android') {
  const oxideManifest = join(nodeModules, '@tailwindcss', 'oxide', 'package.json')
  if (existsSync(oxideManifest)) {
    const { version } = JSON.parse(readFileSync(oxideManifest, 'utf8'))
    await ensurePackage('@tailwindcss/oxide-wasm32-wasi', version)
  }

  const lightningcssVersion =
    dependencyVersion(join(nodeModules, '@tailwindcss', 'node', 'package.json'), 'lightningcss') ??
    '1.32.0'
  await ensurePackage('lightningcss-wasm', lightningcssVersion)
  ensureLightningcssShims()
}
