#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// On Android (Termux and similar) the dynamic linker refuses to dlopen the
// native N-API addons shipped by Rolldown, Oxide and Lightning CSS, so the
// toolchain is pushed onto its WASI fallbacks there. The wasm thread pool is
// held at one worker because the threaded wasm bindings crash when they fan
// out on Android. Both variables are inert on every other platform, so this
// wrapper is safe to use everywhere.
if (process.platform === 'android') {
  process.env.NAPI_RS_FORCE_WASI ??= 'true'
  process.env.NAPI_RS_ASYNC_WORK_POOL_SIZE ??= '1'
}

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('usage: node scripts/env.mjs <command> [args...]')
  process.exit(2)
}

// npm puts node_modules/.bin on PATH for scripts, but this wrapper is also
// useful by hand from a plain shell, where that PATH entry is missing.
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
let executable = command
if (!command.includes('/')) {
  const local = join(projectRoot, 'node_modules', '.bin', command)
  if (existsSync(local)) {
    executable = local
  } else if (process.platform === 'win32' && existsSync(`${local}.cmd`)) {
    executable = `${local}.cmd`
  }
}

const child = spawn(executable, args, {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
