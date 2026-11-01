# AGENTS.md

Inlign is a local-first notepad for drafting math, built as a React PWA with a
Rust math engine compiled to WebAssembly. The repository is a pnpm workspace
plus a Cargo workspace.

This is the foundation milestone. It proves the toolchain end to end: the web
app starts a worker, the worker imports the generated WASM package, and
`version()` returns `0.1.0` from the Rust core. There is no notepad UI and no
math yet. The card notepad (notebooks, one line per card, drag, persistence,
themes, import/export) is the next milestone.

## Requirements

- Node `>=22.22.2 <23`. The upper bound and exact floor come from the toolchain;
  jsdom 30 requires at least 22.22.2. `.nvmrc` selects 22.
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
| `pnpm typecheck` | Build the WASM package, then run `tsc -b` for the web app. |
| `pnpm lint` | Build the WASM package, then run ESLint with zero warnings. |
| `pnpm format` | Write Prettier formatting for the web app. |
| `pnpm format:check` | Check Prettier formatting for the web app. |
| `pnpm test` | Build the WASM package, then run Vitest once. |
| `pnpm test:watch` | Build the WASM package, then run Vitest in watch mode. |
| `pnpm test:e2e` | Run `pnpm build`, then Playwright against the preview server. |
| `pnpm --filter @inlign/web preview` | Serve the built app on `0.0.0.0:7406` with a strict port. |
| `pnpm --filter @inlign/web exec playwright install --with-deps chromium` | Install the Playwright browser used by CI and local e2e runs. |
| `cargo fmt --check --all` | Check Rust formatting across the workspace. |
| `cargo clippy --workspace --all-targets -- -D warnings` | Lint all Rust targets, denying warnings. |
| `cargo test --workspace` | Run the Rust tests natively. |

`dev`, `build`, `typecheck`, `lint`, `test` and `test:watch` all run
`build:wasm` first, because the web app imports the generated package and
`pkg/` is never committed. `test:e2e` runs `pnpm build` first for the same
reason. `format` and `format:check` are scoped to the web app; they do not
format `docs/` or `.superpowers/`.

## Architecture boundaries

- **Rust core is pure.** `crates/engine` has no `wasm-bindgen`, DOM, React or
  storage dependencies. It must stay testable with plain `cargo test`.
- **WASM facade is thin.** `crates/engine-wasm` only exposes the core across
  `#[wasm_bindgen]`. No logic belongs there.
- **WASM lives in the worker.** The UI never imports `@inlign/engine-wasm`
  directly. `src/engine/client.ts` owns a request-id/promise map;
  `src/engine/worker.ts` answers typed requests. The worker never throws across
  the boundary; failures come back as `{ id, error }`.
- **The worker is an ES module.** `worker.format: "es"` in
  `apps/web/vite.config.ts` is required because the generated WASM module uses
  top-level await. wasm-bindgen 0.2.130's bundler output has no `init`
  function and instantiates WASM while it is imported, so the worker registers
  its message listener synchronously and defers the import with
  `import("@inlign/engine-wasm")`. Keep that order: registering the listener
  after an await would drop early requests.
- **Data layer comes next.** Notebooks and settings will go through repository
  hooks over Dexie (IndexedDB). No global store, no URL router.
- **Theme uses semantic tokens.** Components use CSS custom properties for
  surfaces, text, outlines and status. Raw hex stays in the theme source and
  the static PWA manifest.

## Hard rules

- One logical line per card. A line is `{ id: string; text: string }`; a
  notebook always has at least one line.
- No math in this milestone: no parsing, classification, solving, checking,
  highlighting, results or conflicts. Only `version()` crosses into Rust.
- No raw hex in components. Use semantic theme tokens.
- No network requests after load, no accounts, no telemetry. English strings
  are hard-coded; there is no i18n layer.
- Undo is the textarea's native undo only. There is no structural undo.
- Generated files never enter git: `packages/engine-wasm/pkg/**` and
  `apps/web/dist/**` are ignored. The committed package shim at
  `packages/engine-wasm/package.json` points at the generated output, and the
  generated `accents.css` is committed and drift-checked.
- Do not edit the approved spec or plan under `docs/superpowers/` to match the
  code. If reality differs, record it here and in the README.
- `pnpm format:check` covers the web app only. Do not run Prettier over
  `docs/`, `.superpowers/`, or the approved spec and plan.
- PWA install and service-worker registration require a secure context:
  `localhost` or HTTPS. The LAN address `http://<host>:7406` serves the app but
  will not register the service worker.
- Do not commit `.ai-state`, `.superpowers/`, build output, or test reports.

## Design record

- Palette: skill `design` — six accents, default blue
- Themes: Light / Dark / OLED; first run follows prefers-color-scheme; OLED opt-in
- Type: JetBrains Mono
- Approved: 2026-11-01
