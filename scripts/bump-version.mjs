import { readFile, writeFile } from 'node:fs/promises'

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const CARGO_VERSION = /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/

const version = process.argv[2]
if (!version || !SEMVER.test(version)) {
  console.error('usage: npm run version:set -- <version>')
  process.exit(2)
}

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const write = (path, contents) => writeFile(new URL(path, import.meta.url), contents)

const pkg = JSON.parse(await read('../package.json'))
const previous = pkg.version
const cargo = await read('../src-tauri/Cargo.toml')
const cargoMatch = cargo.match(CARGO_VERSION)
if (cargoMatch === null) {
  console.error('could not find `version` under [package] in src-tauri/Cargo.toml')
  process.exit(1)
}
if (previous === version && cargoMatch[2] === version) {
  console.log(`already at ${version}`)
  console.log(`next: add the CHANGELOG.md entry, then: git tag v${version}`)
  process.exit(0)
}

pkg.version = version
await write('../package.json', `${JSON.stringify(pkg, null, 2)}\n`)

const lock = JSON.parse(await read('../package-lock.json'))
if (lock.version !== undefined) lock.version = version
if (lock.packages?.['']?.version !== undefined) lock.packages[''].version = version
await write('../package-lock.json', `${JSON.stringify(lock, null, 2)}\n`)

await write('../src-tauri/Cargo.toml', cargo.replace(CARGO_VERSION, `$1${version}$3`))

console.log(`version ${previous} -> ${version}`)
console.log('updated package.json, package-lock.json and src-tauri/Cargo.toml')
console.log(`next: add the CHANGELOG.md entry, then: git tag v${version}`)
