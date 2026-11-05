# AGENTS.md

Inlign is a local-first notepad for drafting math, built as a React PWA with a
Rust math engine compiled to WebAssembly. The repository is a pnpm workspace
plus a Cargo workspace.

The foundation, card notepad and variable engine milestones are complete:
notebooks, one-line card editing, autosave, reordering, themes and accents,
`.inlign` transfer, JSON backup and restore, the installable PWA, math token
highlighting, and live math evaluation are implemented and tested. Every
non-empty line is an equation. An app-level `EngineClient` and its module worker
are wired; the UI never imports the WASM package directly. Annotations are
derived from engine responses and never stored.

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
| `./scripts/live.sh` | Build the WASM package, then start the detached Vite dev server on `0.0.0.0:7406` (override with `LIVE_SERVER_PORT`); logs to `/tmp/inlign-liveserver.log`; stop with `kill $(cat /tmp/inlign-liveserver.pid)`. |
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
| `cargo test --release -p inlign-engine --test performance` | Run the 500-line release performance guard; it asserts under 50 ms. |

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
  storage dependencies. It must stay testable with plain `cargo test`. Its
  modules are `lexer`, `parser`, `ast`, `solver`, `format` and `evaluate`;
  `evaluate()` walks the lines in order.
- **WASM facade is thin.** `crates/engine-wasm` only exposes the core across
  `#[wasm_bindgen]` with serde DTOs. It exports `version()` and `evaluate()`;
  no solver or formatting logic belongs there.
- **The engine is wired at app level.** `App` creates one `EngineClient` in an
  effect. `useEngineEvaluation` debounces notebook lines by 120 ms, sends a
  stateless `evaluate` request to the module worker, and maps results by line
  id. The UI never imports `@inlign/engine-wasm` directly. Annotations are
  derived from responses and never stored. A notebook with `ignoreCase` set
  lowercases its input at this boundary; the Rust engine itself stays
  case-sensitive. The client is unit-tested with a stubbed `Worker`; the worker
  is implemented but not directly unit-tested. The worker never throws across
  the boundary; failures come back as `{ id, error }`.
- **The worker is an ES module.** `worker.format: "es"` in
  `apps/web/vite.config.ts` is required because the generated WASM module uses
  top-level await. wasm-bindgen 0.2.130's bundler output has no `init`
  function and instantiates WASM while it is imported, so the worker registers
  its message listener synchronously and defers the import with
  `import("@inlign/engine-wasm")`. Keep that order: registering the listener
  after an await would drop early requests.
- **Math highlighting is presentation only.** `src/features/editor/mathSyntax.ts`
  tokenizes numbers, operators and call names for a color layer behind the
  transparent textarea. It adds color only; the engine does the parsing,
  solving and checking. The textarea still owns the editable text, selection
  and undo.
- **Double-space acceptance uses native `beforeinput`.** `useLineKeys` attaches
  the listener to the textarea because Android keyboards can report spaces as
  `Unidentified` with keyCode 229, and React's synthetic `onBeforeInput` does
  not reach the textarea here. Keep keydown for Tab and structural keys.
- **Data layer is implemented.** Notebooks and settings go through Dexie
  repositories in `src/data/` and React hooks such as `useNotebooks`,
  `useSettings` and `useTransfer`. IndexedDB is the store. There is no global
  store and no URL router.
- **IDs use `createId()`.** `crypto.randomUUID` is secure-context only, so use
  `src/lib/id.ts` to keep notebook and line ids working on plain-HTTP LAN
  origins.
- **Theme uses semantic tokens.** Components use CSS custom properties for
  surfaces, text, outlines and status. Raw hex stays in the theme source and
  the static PWA manifest.

## Hard rules

- One logical line per card. A line is `{ id: string; text: string }`; a
  notebook always has at least one line.
- Every non-empty line is an equation with exactly one top-level `=`. Prose
  and bare expressions are invalid. Incomplete syntax is not an error; empty
  lines are ignored. Evaluation is prefix-only: a suggestion uses values known
  before the line, and a later value never fills an earlier line. The first
  error stops evaluation; later lines are skipped and dimmed. A conflicting
  assignment keeps the first value.
- One set-valued variable only. The solver covers linear equations, quadratics,
  pure powers with a known exponent and simple rational equations. Coupled
  nonlinear systems, a second set, unknown exponents, functions, units,
  comparisons, square brackets, `%`, general implicit multiplication such as
  `2a` or `(a)(b)`, and commas stay unsolved or invalid. A dot between name
  tokens is multiplication (`x.y` means `x × y`); bare `xy` remains one
  multi-letter name.
- Variable names are case-sensitive by default. `Notebook.ignoreCase` is a
  per-notebook option; when true, `useEngineEvaluation` lowercases the engine
  input so `X` and `x` are one name. New notebooks take
  `Settings.defaultIgnoreCase`; existing notebooks and old backups default to
  false. The per-notebook toggle lives in the notebook menu and the default in
  Settings → New notebooks. Do not make the Rust engine globally
  case-insensitive.
- Suggestions appear only on the focused card with the caret at the end and an
  empty right-hand side. Tab, or two Spaces within 400 ms, inserts only the
  missing suffix; without a visible suggestion both spaces remain ordinary
  spaces. Escape dismisses the suggestion. Annotations are derived from engine
  responses and never stored.
- The highlighter is presentation only: it adds color and does not parse or
  evaluate.
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

- Math-only product direction: every non-empty line is an equation; prose is
  invalid
- Annotation roles: suggestions and skipped lines use `on-surface-variant`;
  errors use `loss` text, border and outline
- Palette: six accents, default blue
- Themes: Light / Dark / OLED; first run follows `prefers-color-scheme`; OLED is
  opt-in only
- Type: JetBrains Mono
- Approved: 2026-11-01
