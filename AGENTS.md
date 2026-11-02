# AGENTS.md

Inlign is a local-first notepad for drafting math, built as a React PWA with a
Rust math engine compiled to WebAssembly. The repository is a pnpm workspace
plus a Cargo workspace.

The foundation and card notepad milestone is complete: notebooks, one-line card
editing, autosave, reordering, themes and accents, `.inlign` transfer, JSON
backup and restore, and the installable PWA are implemented and tested. Math is
still to come. `EngineClient` is unit-tested; its module worker is implemented
but not directly unit-tested. The UI does not instantiate either in this
milestone; only `version()` crosses into Rust.

## Requirements

- Node `>=22.22.2 <23`. jsdom 30 sets the `>=22.22.2` floor; `<23` is the
  project's Node 22 support cap. `.nvmrc` selects 22.
- pnpm 12, pinned by `packageManager` in `package.json` (currently 12.10.1).
- Rust stable with the `wasm32-unknown-unknown` target, rustfmt and clippy.
  The crates use edition 2024 and MSRV 1.85.
- wasm-pack on `PATH`.
- Playwright Chromium for end-to-end tests.

## Commands

Run from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm install` | Install workspace dependencies. |
| `pnpm dev` | Build the WASM package, then serve Vite on `0.0.0.0:7406` with a strict port. |
| `pnpm build` | Build the WASM package, then the production PWA into `apps/web/dist/`. |
| `pnpm build:wasm` | Run `wasm-pack build --target bundler` into `packages/engine-wasm/pkg/`. |
| `pnpm generate:accents` | Regenerate the committed accent tokens in `apps/web/src/theme/accents.css`. |
| `pnpm generate:accents && git diff --exit-code -- apps/web/src/theme/accents.css` | Regenerate the accent tokens and fail if the committed file changes. |
| `pnpm typecheck` | Build the WASM package, then run `tsc -b` for the web app. |
| `pnpm lint` | Build the WASM package, then run ESLint with zero warnings. |
| `pnpm format` | Write Prettier formatting for the web app. |
| `pnpm format:check` | Check Prettier formatting for the web app. |
| `pnpm test` | Build the WASM package, then run Vitest once. |
| `pnpm test:watch` | Build the WASM package, then run Vitest in watch mode. |
| `pnpm test:e2e` | Run `pnpm build`, then Playwright against the preview server. |
| `pnpm --filter @inlign/web preview` | Serve the built app on `0.0.0.0:7406` with a strict port. |
| `pnpm --filter @inlign/web exec playwright install chromium` | Install the Playwright browser locally, after `pnpm install`. Add `--with-deps` on Linux if system libraries are missing; that may require sudo. CI uses `--with-deps`. |
| `cargo fmt --check --all` | Check Rust formatting across the workspace. |
| `cargo clippy --workspace --all-targets -- -D warnings` | Lint all Rust targets, denying warnings. |
| `cargo test --workspace` | Run the Rust tests natively. |

`dev`, `build`, `typecheck`, `lint`, `test` and `test:watch` all run
`build:wasm` first, because the web app imports the generated package and
`pkg/` is never committed. `test:e2e` runs `pnpm build` first for the same
reason. `format` and `format:check` are scoped to the web app; they do not
format `docs/` or `.superpowers/`. CI runs the accent drift check after
`format:check`, so a stale `accents.css` fails the build.

Install Playwright Chromium only after `pnpm install`; before that, the filtered
`playwright` binary does not exist and the command fails on a fresh clone. The
local form is `pnpm --filter @inlign/web exec playwright install chromium`. On
Linux, add `--with-deps` if system libraries are missing, but that form may
require sudo. CI uses `--with-deps` because its runner has passwordless sudo.

## Architecture boundaries

- **Rust core is pure.** `crates/engine` has no `wasm-bindgen`, DOM, React or
  storage dependencies. It must stay testable with plain `cargo test`.
- **WASM facade is thin.** `crates/engine-wasm` only exposes the core across
  `#[wasm_bindgen]`. No logic belongs there.
- **Engine client and worker are implemented, not wired.** The UI never imports
  `@inlign/engine-wasm` directly. `src/engine/client.ts` owns a request-id and
  promise map; `src/engine/worker.ts` answers typed requests. The client is
  unit-tested with a stubbed `Worker`; the worker is implemented but not
  directly unit-tested. The UI does not create an `EngineClient` in this
  milestone. The worker never throws across the boundary; failures come back as
  `{ id, error }`. Only `version()` is exposed across the WASM facade.
- **The worker is an ES module.** `worker.format: "es"` in
  `apps/web/vite.config.ts` is required because the generated WASM module uses
  top-level await. wasm-bindgen 0.2.130's bundler output has no `init`
  function and instantiates WASM while it is imported, so the worker registers
  its message listener synchronously and defers the import with
  `import("@inlign/engine-wasm")`. Keep that order: registering the listener
  after an await would drop early requests.
- **Data layer is implemented.** Notebooks and settings go through Dexie
  repositories in `src/data/` and React hooks such as `useNotebooks`,
  `useSettings` and `useTransfer`. IndexedDB is the store. There is no global
  store and no URL router.
- **Theme uses semantic tokens.** Components use CSS custom properties for
  surfaces, text, outlines and status. Raw hex stays in the theme source and
  the static PWA manifest.

## Hard rules

- One logical line per card. A line is `{ id: string; text: string }`; a
  notebook always has at least one line.
- No math in this milestone: no parsing, classification, solving, checking,
  highlighting, results or conflicts. Only `version()` crosses into Rust.
- No raw hex in components. Use semantic theme tokens.
- No network requests for app data or third-party services after load, no
  accounts, no telemetry. English strings are hard-coded; there is no i18n layer.
- Undo is the textarea's native undo only. There is no structural undo.
- Generated files never enter git: `packages/engine-wasm/pkg/**` and
  `apps/web/dist/**` are ignored. The committed package shim at
  `packages/engine-wasm/package.json` points at the generated output.
  `apps/web/src/theme/accents.css` is generated but committed and
  drift-checked by rerunning `pnpm generate:accents`.
- Do not edit the approved spec or plan under `docs/superpowers/` to match the
  code. If reality differs, record it here and in the README.
- `pnpm format:check` covers the web app only. Do not run Prettier over
  `docs/`, `.superpowers/`, or the approved spec and plan.
- PWA install and service-worker registration require a secure context:
  `localhost` or HTTPS. The LAN address `http://<host>:7406` serves the app but
  will not register the service worker.
- Do not commit `.ai-state`, `.superpowers/`, build output, or test reports.

## Design record

- Palette: six accents, default blue
- Themes: Light / Dark / OLED; first run follows `prefers-color-scheme`; OLED is
  opt-in only
- Type: JetBrains Mono
- Approved: 2026-11-01
