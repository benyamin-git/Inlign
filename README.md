# Inlign

A local-first notepad for drafting math, with one line per card. Every
non-empty line is an equation. A Rust engine compiled to WebAssembly computes
and cross-checks values in place.

> The foundation, card notepad and variable engine milestones are complete.
> Notebooks, one-line card editing, autosave, reordering, themes and accents,
> `.inlign` transfer, JSON backup and restore, the installable PWA, math token
> highlighting, and live math evaluation work. Grey suggestions, inline errors
> and dimmed lines after a stopped evaluation are part of the engine. The
> previous implementation is archived at
> [benyamin-git/Inlign-legacy](https://github.com/benyamin-git/Inlign-legacy).

## What works

- Notebooks and settings persist in IndexedDB through Dexie repositories and
  React hooks. There is no global store and no URL router.
- Every non-empty line is an equation. The app sends the notebook to a Rust
  engine in a module worker after a 120 ms debounce, through the app-level
  `EngineClient` and `useEngineEvaluation`. The engine walks the lines in order
  and returns `ok`, `empty`, `incomplete`, `error` or `skipped` for each.
- Evaluation is prefix-only. A focused line with an empty right-hand side shows
  one grey suggestion when its value is already known. Incomplete syntax and
  valid unsolved lines are not errors and stay unmarked. Tab inserts only the
  missing value; on a touch keyboard, pressing Space twice does the same. Escape
  dismisses the suggestion. The first error shows red inline text and a red card
  border, and later lines are dimmed and skipped until the error is fixed. A
  conflicting assignment keeps the first value.
- The solver handles linear equations, quadratics, pure powers and simple
  rational equations, including one set-valued variable at a time. Symmetric
  roots display as `±v`; non-symmetric sets display descending and Tab inserts
  the largest value. Coupled nonlinear systems, a second set and unknown
  exponents are valid but unsolved.
- Variable names are case-sensitive by default. Each notebook's menu can enable
  Ignore variable case, making `X` and `x` the same name; Settings chooses the
  default for notebooks created from then on. Existing notebooks stay
  case-sensitive until changed.
- Multiplication is written with `*`, `×`, `·`, or a dot between names
  (`x.y`). Bare `xy` remains one multi-letter variable name, and other implicit
  forms such as `2a` are not supported.
- The editor renders one logical line per card: Enter splits, Backspace and
  Delete merge, pasted newlines become separate cards, and cards can be dragged
  by their grip or moved with the keyboard.
- Numbers, operators and function-call names are highlighted behind the card
  text. The highlighter is a presentation tokenizer: it adds color only, while
  the engine parses, solves and checks the equations.
- Text edits autosave after a 400 ms pause and flush on window blur, `pagehide`
  and when the page is hidden, so a reload or a notebook switch keeps the latest
  lines.
- Notebooks reorder within the pinned and unpinned sections by pointer, touch or
  keyboard. Pinning moves a notebook to the top of its new section.
- Settings switches between Light, Dark and OLED and all six accents. The choice
  is stored in IndexedDB, mirrored to localStorage for the pre-paint theme
  script, and follows the OS until a theme is chosen. Settings → New notebooks
  also sets whether new notebooks start with case-insensitive variable names.
- The notebook menu exports a notebook as a slugified `.inlign` plain-text file
  with one line per row and no trailing newline. Settings → Data imports an
  `.inlign` file as a new notebook and can export the active notebook.
- Settings → Data exports a versioned `inlign-backup.json` backup containing
  every notebook, each notebook's case setting and the app settings. Import
  offers Add as new (fresh ids), Merge (update matching ids, add missing, keep
  the rest) or Replace all. Replace starts a safety-backup download before
  asking for a second confirmation, and every mode validates the file before
  writing.
- The math engine is a pure Rust crate with a thin WASM facade. The UI never
  imports the generated package directly; it goes through the typed worker
  protocol, and annotations are derived from responses rather than stored with
  the notebook.
- Vitest unit tests, Playwright browser tests and cargo tests cover the
  workspace, including the engine's suggestions, errors and accessibility.

## Why it exists

Calculators work one expression at a time; spreadsheets work in cells. Inlign is
for drafting a calculation line by line: one equation per card, with every value
computed in place and checked against the equations already entered. Prose is
not part of the document; every non-empty line is math.

## Prerequisites

- Node `>=22.22.2 <23`. jsdom 30 sets the `>=22.22.2` floor; `<23` is the
  project's Node 22 support cap. `.nvmrc` selects 22 and `pnpm install`
  enforces the range.
- pnpm 12 (`packageManager` pins 12.10.1).
- Rust stable with the `wasm32-unknown-unknown` target, rustfmt and clippy.
  The crates use edition 2024 and MSRV 1.85.
- wasm-pack.
- Playwright Chromium for end-to-end tests.

```sh
rustup target add wasm32-unknown-unknown
rustup component add rustfmt clippy
cargo install wasm-pack
```

## Quick start

Install dependencies first:

```sh
pnpm install
```

The end-to-end tests need Chromium. Install it after `pnpm install`:

```sh
pnpm --filter @inlign/web exec playwright install chromium
```

On Linux, add `--with-deps` if Chromium's system libraries are missing. That
form may require sudo. CI uses `--with-deps` because its runner provides
passwordless sudo.

Then start the app:

```sh
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

For a detached live server, run:

```sh
./scripts/live.sh
```

It builds the WASM package, starts the Vite dev server in the background on
`0.0.0.0:7406`, and logs to `/tmp/inlign-liveserver.log`. Override the port with
`LIVE_SERVER_PORT`; stop it with `kill $(cat /tmp/inlign-liveserver.pid)`.

## Commands

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Build WASM, then start the Vite dev server on `0.0.0.0:7406`. |
| `./scripts/live.sh` | Build WASM, then start a detached Vite dev server on `0.0.0.0:7406`. |
| `pnpm build` | Build WASM, then the production PWA into `apps/web/dist/`. |
| `pnpm build:wasm` | Build `packages/engine-wasm/pkg/` with `wasm-pack --target bundler`. |
| `pnpm generate:accents` | Regenerate the committed accent tokens in `apps/web/src/theme/accents.css`. |
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
| `cargo test --release -p inlign-engine --test performance` | Run the 500-line release performance guard; it asserts under 50 ms. |

`dev`, `build`, `typecheck`, `lint`, `test` and `test:watch` all run
`build:wasm` first because `packages/engine-wasm/pkg/` is generated and
git-ignored. `test:e2e` runs `pnpm build` first. `format` and `format:check`
cover the web app only, not `docs/`.

The performance guard prints the 500-line evaluation time. Its 50 ms assertion
only runs in a release build; `cargo test --workspace` covers correctness in a
debug build.

`pnpm generate:accents` derives every accent role for Light, Dark and OLED
from the house OKLCH seeds and writes `apps/web/src/theme/accents.css`. That
file is committed and drift-checked: rerun the script, then
`git diff --exit-code -- apps/web/src/theme/accents.css` must stay clean.

## Project layout

```text
apps/web/                   React 19 + Vite 8 PWA
  src/app/                  app shell and empty state
  src/data/                 Dexie models, repositories, transfer and backup
  src/engine/               EngineClient, typed protocol, module worker
  src/features/editor/      card editor, engine annotations, token highlighting,
                            line operations, autosave and drag
  src/features/notebooks/   sidebar, notebook hooks and ordering
  src/features/settings/    theme, accent and settings sheet
  src/features/transfer/    `.inlign` and JSON import/export dialogs
  src/lib/                  debounce and download helpers
  src/theme/                tokens.css, generated accents.css, theme helpers
  src/ui/                   shared buttons, dialogs, menus, fields and checkbox
  src/test/                 Vitest setup
  e2e/                      Playwright tests
  public/                   favicon and PWA icons
crates/engine/              pure Rust core, no wasm-bindgen
  src/lexer.rs              tokenization
  src/parser.rs             expressions and the single top-level `=`
  src/ast.rs                expression and equation types
  src/solver.rs             linear, quadratic, power and rational solving
  src/format.rs             number formatting, tolerance and suggestions
  src/evaluate.rs           line-by-line prefix evaluation
  tests/performance.rs      500-line release budget
crates/engine-wasm/         thin #[wasm_bindgen] serde facade
packages/engine-wasm/       committed package.json shim; generated pkg/ ignored
scripts/build-wasm.mjs        wasm-pack invocation used by the root scripts
scripts/generate-accents.mjs  OKLCH accent generator for accents.css
docs/superpowers/           approved spec and implementation plan
.github/workflows/ci.yml    quality gate
```

## PWA and offline

The production build registers an auto-updating service worker and precaches
the app shell: HTML, JavaScript, CSS, bundled JetBrains Mono fonts, icons, the
manifest, and the compiled WebAssembly module. The math worker loads the WASM
asset at runtime. After one successful load, the app reloads offline from the
precache and IndexedDB.

PWA install and service-worker registration require a secure context:
`localhost` or HTTPS. The LAN address `http://<host>:7406` serves the app, but
the browser will not register the service worker there. The Vite dev server
does not register the service worker either; use the production build and
preview server to test install and offline behavior.

## Data and privacy

There are no accounts, no telemetry and no requests to third-party services
after the page loads. Notebooks and app settings are stored in IndexedDB in the
browser. `.inlign` files export a single notebook as plain text, and
Settings → Data exports a versioned JSON backup of every notebook, each
notebook's case setting and the app settings. A restore validates the file and
offers Add, Merge or Replace before writing; Replace starts a safety-backup
download and requires a second confirmation.

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
cargo test --release -p inlign-engine --test performance -- --nocapture
pnpm typecheck
pnpm lint
pnpm format:check
pnpm generate:accents
git diff --exit-code -- apps/web/src/theme/accents.css
pnpm test
pnpm --filter @inlign/web exec playwright install --with-deps chromium
pnpm test:e2e
pnpm build
```

## Limitations

- The document is math-only. Every non-empty line must be an equation with
  exactly one top-level `=`. Prose, bare expressions and a second `=` are
  invalid. Incomplete syntax is not an error and does not stop evaluation.
- The solver covers linear equations, quadratics, pure powers with a known
  exponent and simple rational equations. It does not solve coupled nonlinear
  systems, systems with more than one set-valued variable, or equations with an
  unknown exponent. A valid equation outside that scope stays unmarked.
- Suggestions are prefix-only: a value entered later never fills an earlier
  incomplete line. Only one set-valued variable exists at a time; a set is not
  propagated into a second variable.
- Values format with at most 12 significant digits, negative zero formats as
  `0`, and numeric equality uses a relative tolerance of `1e-9`. Precision and
  tolerance are constants, not settings.
- The engine produces numeric values only, with no symbolic algebra or
  derived-form output.
- Functions, constants, units, comparisons, square brackets, `%`, general
  implicit multiplication such as `2a` or `(a)(b)`, and commas as input are
  not supported. A bare `xy` remains one variable name; use `x.y` for a
  product.
- No structural undo; only the textarea's native undo exists.
- The 500-line performance test must finish in under 50 ms in a release build;
  the editor has no list virtualization.
- iOS may evict IndexedDB storage, so keep `.inlign` or JSON backup exports of
  anything important.

MIT licensed; see `LICENSE`.
