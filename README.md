# Inlign

A local-first notepad for drafting math, with one line per card. The document is
plain text; a Rust engine compiled to WebAssembly will compute and cross-check
values in place.

> Early development. The foundation milestone is complete: the workspace,
> Rust/WASM engine pipeline, worker, build, tests and an installable PWA all
> work. The card notepad UI does not exist yet, and neither does any math. The
> previous implementation is archived at
> [benyamin-git/Inlign-legacy](https://github.com/benyamin-git/Inlign-legacy).

## What works now

- The Vite app starts a module Web Worker, which imports the generated
  `@inlign/engine-wasm` package and returns `0.1.0` from the Rust core.
- `wasm-pack` builds `inlign-engine-wasm` from the pure `inlign-engine` crate.
- Vitest unit tests, a Playwright smoke test and cargo tests pass.
- The production build is an installable PWA with a precached app shell, WASM
  binary and icons.
- The page currently shows the engine version. Notebooks, cards, persistence,
  themes and import/export are the next milestone.

## Why it exists

Calculators work one expression at a time; spreadsheets work in cells. Inlign is
for drafting a solution the way you would on paper — prose, values and formulas
— while every value is computed in place and checked against the rest of the
document.

## Prerequisites

- Node `>=22.22.2 <23`. The exact floor is set by jsdom 30; `.nvmrc` selects 22
  and `pnpm install` enforces the range.
- pnpm 12 (`packageManager` pins 12.10.1).
- Rust stable with the `wasm32-unknown-unknown` target, rustfmt and clippy.
  The crates use edition 2024 and MSRV 1.85.
- wasm-pack.
- Playwright Chromium for end-to-end tests.

```sh
rustup target add wasm32-unknown-unknown
rustup component add rustfmt clippy
cargo install wasm-pack
pnpm --filter @inlign/web exec playwright install --with-deps chromium
```

## Quick start

```sh
pnpm install
pnpm dev
```

`pnpm dev` builds the WASM package first, then serves the app on
`0.0.0.0:7406` with a strict port. Open `http://localhost:7406`. The same app is
reachable from another device on the LAN at `http://<host>:7406`.

To run the production build:

```sh
pnpm build
pnpm --filter @inlign/web preview
```

The preview server also binds `0.0.0.0:7406` with a strict port.

## Commands

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Build WASM, then start the Vite dev server on `0.0.0.0:7406`. |
| `pnpm build` | Build WASM, then the production PWA into `apps/web/dist/`. |
| `pnpm build:wasm` | Build `packages/engine-wasm/pkg/` with `wasm-pack --target bundler`. |
| `pnpm typecheck` | Build WASM, then typecheck the web app with `tsc -b`. |
| `pnpm lint` | Build WASM, then run ESLint with zero warnings. |
| `pnpm format` | Format the web app with Prettier. |
| `pnpm format:check` | Check web app formatting with Prettier. |
| `pnpm test` | Build WASM, then run Vitest once. |
| `pnpm test:watch` | Build WASM, then run Vitest in watch mode. |
| `pnpm test:e2e` | Build the app, then run Playwright against the preview server. |
| `cargo fmt --check --all` | Check Rust formatting. |
| `cargo clippy --workspace --all-targets -- -D warnings` | Lint Rust, denying warnings. |
| `cargo test --workspace` | Run the Rust tests natively. |

`dev`, `build`, `typecheck`, `lint`, `test` and `test:watch` all run
`build:wasm` first because `packages/engine-wasm/pkg/` is generated and
git-ignored. `test:e2e` runs `pnpm build` first. `format` and `format:check`
cover the web app only, not `docs/`.

## Project layout

```text
apps/web/                   React 19 + Vite 8 PWA
  src/app/                  app shell
  src/engine/               worker client, protocol, worker
  src/test/                 Vitest setup
  e2e/                      Playwright tests
  public/                   favicon and PWA icons
crates/engine/              pure Rust core, no wasm-bindgen
crates/engine-wasm/         thin #[wasm_bindgen] facade
packages/engine-wasm/       committed package.json shim; generated pkg/ ignored
scripts/build-wasm.mjs      wasm-pack invocation used by the root scripts
docs/superpowers/           approved spec and implementation plan
.github/workflows/ci.yml    quality gate
```

## PWA and offline

The production build registers an auto-updating service worker and precaches
the app shell, WASM binary, icons and other static assets. After one successful
load, the app can be reloaded offline from the browser cache.

PWA install and service-worker registration require a secure context:
`localhost` or HTTPS. The LAN address `http://<host>:7406` serves the app, but
the browser will not register the service worker there. The Vite dev server
does not register the service worker either; use the production build and
preview server to test install and offline behavior.

## Data and privacy

There are no accounts, no telemetry and no requests to third-party services
after the page loads. The app currently stores nothing; notebook data will live
in IndexedDB in the browser, with `.inlign` and JSON files used for export and
backup.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests. On
`ubuntu-latest` it installs Node 22 with pnpm 12, Rust stable with the
`wasm32-unknown-unknown` target, rustfmt, clippy and wasm-pack, then runs:

```sh
pnpm install --frozen-lockfile
pnpm build:wasm
cargo fmt --check --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm --filter @inlign/web exec playwright install --with-deps chromium
pnpm test:e2e
pnpm build
```

## Limitations

- No math engine yet: no parsing, solving, checking, results or conflicts.
- No notebooks, cards, drag and drop, autosave or import/export yet.
- No structural undo; only the textarea's native undo will exist.
- iOS may evict IndexedDB storage, so backups matter once persistence lands.

MIT licensed; see `LICENSE`.
