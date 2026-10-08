import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const [inputArg, outputArg] = process.argv.slice(2)
if (!inputArg || !outputArg) {
  console.error('usage: node scripts/collect-artifacts.mjs <input-dir> <output-dir>')
  process.exit(2)
}

const inputDir = resolve(inputArg)
const outputDir = resolve(outputArg)

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

const rules = [
  { extension: '.exe', name: `inlign-${version}-windows-x64-setup.exe` },
  { extension: '.dmg', name: `inlign-${version}-macos.dmg` },
  { extension: '.AppImage', name: `inlign-${version}-linux.AppImage` },
  { extension: '.deb', name: `inlign-${version}-linux.deb` },
  { extension: '.apk', name: `inlign-${version}-android.apk` },
  { extension: '.zip', name: `inlign-${version}-web.zip` },
]

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(path)
    } else if (entry.isFile()) {
      yield path
    }
  }
}

let files
try {
  files = []
  for await (const file of walk(inputDir)) {
    files.push(file)
  }
} catch (error) {
  console.error(`cannot read ${inputDir}: ${error.message}`)
  process.exit(1)
}

const candidatesByRule = new Map(rules.map((rule) => [rule, []]))
const unknown = []
for (const file of files) {
  const name = basename(file)
  const rule = rules.find((candidate) => name.endsWith(candidate.extension))
  if (rule) {
    candidatesByRule.get(rule).push(file)
  } else {
    unknown.push(file)
  }
}

for (const file of unknown) {
  console.warn(`ignoring unrecognized artifact ${file}`)
}

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

let collected = 0
for (const rule of rules) {
  let candidates = candidatesByRule.get(rule)
  if (candidates.length === 0) {
    continue
  }

  if (rule.extension === '.apk' && candidates.length > 1) {
    const universal = candidates.filter((file) => basename(file).includes('universal'))
    if (universal.length !== 1) {
      console.error(
        `expected exactly one universal APK, found: ${candidates.map((file) => basename(file)).join(', ')}`,
      )
      process.exit(1)
    }
    candidates = universal
  }

  if (candidates.length > 1) {
    console.error(
      `several files match ${rule.extension}: ${candidates.map((file) => basename(file)).join(', ')}`,
    )
    process.exit(1)
  }

  await cp(candidates[0], join(outputDir, rule.name))
  console.log(`${basename(candidates[0])} -> ${rule.name}`)
  collected += 1
}

if (collected === 0) {
  console.error(`no release artifacts found under ${inputDir}`)
  process.exit(1)
}

console.log(`collected ${collected} artifact(s) into ${outputDir}`)
