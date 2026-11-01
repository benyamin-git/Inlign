# Inlign Foundation and Card Notepad — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-11-01-inlign-foundation-design.md`
**Status:** Approved
**Date:** 2026-11-01

## Global constraints

Copied from the spec; these do not change without re-opening the spec.

- Node 22 (`>=22.12`), pnpm 12, Rust stable with `wasm32-unknown-unknown`, and
  wasm-pack are required. Rust edition 2024, MSRV 1.85.
- Dev and preview bind `0.0.0.0:7406` with a strict port. Never fall back.
- Packages: root `inlign`, web `@inlign/web`, generated WASM
  `@inlign/engine-wasm`, Rust crates `inlign-engine` and `inlign-engine-wasm`.
- One logical line per card. A line is `{ id: string; text: string }`; a
  notebook always has at least one line.
- No math in this milestone: no parsing, classification, solving, checking,
  highlighting, results or conflicts. Only `version()` crosses into Rust.
- Maximum TypeScript strictness: `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`,
  `isolatedModules`.
- Generated files never enter git: `packages/engine-wasm/pkg/**` and
  `apps/web/dist/**`. Generated `accents.css` is committed and drift-checked.
- Components use semantic theme tokens, never raw hex.
- No network requests after load, no accounts, no telemetry.
- Undo is the native textarea undo only. No structural undo.
- English strings are hard-coded; no i18n layer.
- `AGENTS.md` records the design; `README.md` records real commands.

## Phase 1 — Scaffold

Phase 1 ends when the app serves on 7406, the worker answers `version()`, the
PWA builds, and every gate runs locally and in CI. No notepad UI yet.

### P1.1 — Root workspace and web app boot

**Files**

- `package.json` (root): private, `packageManager: "pnpm@12.10.1"`,
  `engines.node: ">=22.12"`, scripts `dev` and `build` (P1.3 later prepends
  `build:wasm` to both), and a `pnpm.onlyBuiltDependencies` entry for
  `esbuild`.
- `pnpm-workspace.yaml`: `packages: ["apps/*", "packages/*"]`.
- `.nvmrc` (`22`), `.npmrc` (`engine-strict=true`), `.editorconfig`.
- `.gitignore`: add `node_modules`, `dist`, `apps/web/dist`,
  `packages/engine-wasm/pkg`, `coverage`, `test-results`,
  `playwright-report`, `.env*`, `.ai-state`.
- `apps/web/`: Vite React TypeScript template files — `index.html`,
  `package.json`, `vite.config.ts`, `tsconfig.json`,
  `tsconfig.app.json`, `tsconfig.node.json`, `src/main.tsx`,
  `src/app/App.tsx`, `src/vite-env.d.ts`.
- `vite.config.ts`: `server` and `preview` both
  `{ host: "0.0.0.0", port: 7406, strictPort: true }`.

**Interfaces**

- `apps/web/package.json` name `@inlign/web`, private, scripts `dev`, `build`,
  `preview`, `typecheck`, `lint`, `format`, `format:check`, `test`,
  `test:watch`, `test:e2e`.
- Root `dev`: `pnpm --filter @inlign/web dev`.
- Root `build`: `pnpm --filter @inlign/web build`.

**Steps**

1. Create the workspace files and the Vite app.
2. Replace the template screen with a minimal `<main>` that says "Inlign".
3. Run `pnpm install`; if pnpm reports ignored build scripts, approve `esbuild`
   via the `onlyBuiltDependencies` field.

**Verify**

- `pnpm install` → exit 0.
- `pnpm --filter @inlign/web build` → exit 0 and `apps/web/dist/index.html`
  exists.
- `pnpm dev` (background) then
  `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7406` → `200`.
- Stop the server.

**Commit:** `chore: scaffold pnpm workspace and web app`

### P1.2 — Typecheck, lint, format and unit test gates

**Files**

- `apps/web/tsconfig.app.json`: target ES2022, lib ES2022 + DOM + DOM.Iterable
  + WebWorker, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, `noEmit`,
  and the six strict options from the global constraints plus
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- `eslint.config.js`: flat config with `@eslint/js`, `typescript-eslint`,
  `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
  `eslint-plugin-jsx-a11y`; ignores `dist` and `packages/engine-wasm/pkg`.
- `.prettierrc.json`: `printWidth: 100`, `semi: true`, `singleQuote: false`,
  `trailingComma: "all"`.
- `.prettierignore`: lockfiles, `dist`, `packages/engine-wasm/pkg`.
- `apps/web/vitest.config.ts`: `environment: "jsdom"`, setup file,
  `include: ["src/**/*.test.{ts,tsx}"]`.
- `apps/web/src/test/setup.ts`: `@testing-library/jest-dom/vitest`,
  `fake-indexeddb/auto`, and a no-op `ResizeObserver` stub when the environment
  does not provide one.
- `apps/web/src/test/smoke.test.ts`: asserts `1 + 1 === 2`.
- Root scripts `typecheck`, `lint`, `format`, `format:check`, `test` and
  `test:watch`, each delegating to `@inlign/web`.
- Dev dependencies: `eslint`, `@eslint/js`, `typescript-eslint`, the three
  plugins, `prettier`, `vitest`, `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/user-event`, `@types/*`.

**Verify**

- `pnpm typecheck` → exit 0.
- `pnpm lint` → exit 0, no warnings.
- `pnpm format:check` → exit 0.
- `pnpm test` → `Test Files 1 passed`, `Tests 1 passed`.

**Commit:** `chore: add typecheck, lint, format and unit test gates`

### P1.3 — Rust core, WASM bindings and generated package

**Files**

- `Cargo.toml`: workspace with members `crates/engine`, `crates/engine-wasm`;
  `resolver = "3"`; workspace version `0.1.0`, edition 2024, license MIT,
  `rust-version = "1.85"`; release profile `opt-level = "s"`, `lto = true`,
  `codegen-units = 1`.
- `rust-toolchain.toml`: channel `stable`, targets
  `["wasm32-unknown-unknown"]`, components `["rustfmt", "clippy"]`.
- `crates/engine/Cargo.toml`: package `inlign-engine`, lib name
  `inlign_engine`, no dependencies.
- `crates/engine/src/lib.rs`:
  `pub fn version() -> &'static str { env!("CARGO_PKG_VERSION") }` plus a
  `#[cfg(test)]` test asserting it equals `"0.1.0"`.
- `crates/engine-wasm/Cargo.toml`: package `inlign-engine-wasm`, lib name
  `inlign_engine_wasm`, `crate-type = ["cdylib", "rlib"]`; dependencies
  `wasm-bindgen = "0.2"` and `inlign-engine = { path = "../engine" }`.
- `crates/engine-wasm/src/lib.rs`:
  `#[wasm_bindgen] pub fn version() -> String`.
- `scripts/build-wasm.mjs`: verifies `wasm-pack` exists, then spawns
  `wasm-pack build --target bundler --out-dir ../../packages/engine-wasm/pkg --out-name inlign_engine_wasm`
  with `cwd` set to `crates/engine-wasm`; exits non-zero with install
  instructions when wasm-pack is missing.
- Root script `build:wasm`: `node scripts/build-wasm.mjs`.
- `packages/engine-wasm/package.json`: name `@inlign/engine-wasm`, private,
  `type: "module"`, `main`/`module` `pkg/inlign_engine_wasm.js`, `types`
  `pkg/inlign_engine_wasm.d.ts`.

**Steps**

1. Install the target and tool: `rustup target add wasm32-unknown-unknown` and
   `cargo install wasm-pack` if missing.
2. Add `@inlign/engine-wasm: "workspace:*"` to `apps/web` dependencies.
3. Run `pnpm install` so the workspace link exists.
4. Update root `dev` and `build` to
   `pnpm build:wasm && pnpm --filter @inlign/web <script>`.

**Verify**

- `cargo test --workspace` → both crates compile; the version test passes.
- `pnpm build:wasm` → wasm-pack reports success.
- `test -f packages/engine-wasm/pkg/inlign_engine_wasm_bg.wasm` → exit 0.
- `test -f packages/engine-wasm/pkg/inlign_engine_wasm.d.ts` → exit 0.

**Commit:** `feat: add Rust core and WASM version export`

### P1.4 — Worker client and version ping

**Files**

- `apps/web/src/engine/protocol.ts`: the `EngineRequest` and `EngineResponse`
  union from the spec.
- `apps/web/src/engine/client.ts`:
  `class EngineClient { version(): Promise<string>; dispose(): void }`.
  It creates `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`,
  keeps a `Map<number, { resolve, reject }>`, and rejects pending calls on
  `dispose`.
- `apps/web/src/engine/worker.ts`: imports `init` and `version` from
  `@inlign/engine-wasm`, awaits `init()`, listens for messages, and replies
  `{ id, type: "version", version }`; unknown types reply `{ id, error }`.
- `apps/web/src/engine/client.test.ts`: mocks `Worker` with a class that echoes
  the version response; asserts `version()` resolves and `dispose()` rejects
  pending calls.
- `apps/web/src/app/App.tsx`: renders the engine version in
  `<span data-testid="engine-version">`.
- `apps/web/playwright.config.ts`: `testDir: "e2e"`, baseURL
  `http://127.0.0.1:7406`, Chromium project, webServer
  `command: "pnpm preview"`, `url: "http://127.0.0.1:7406"`,
  `reuseExistingServer: true`.
- `apps/web/e2e/smoke.spec.ts`: asserts the version text matches
  `/^\d+\.\d+\.\d+$/`.
- `apps/web` dev dependency `@playwright/test`, plus
  `pnpm --filter @inlign/web exec playwright install chromium` once locally.
- Root `test:e2e`: `pnpm build && pnpm --filter @inlign/web test:e2e`.

**Steps**

1. Confirm the worker imports the generated package through the workspace
   link, never a relative path into `packages/`.
2. If Vite fails to bundle the `.wasm` inside the worker, switch wasm-pack to
   `--target web`, add `vite-plugin-wasm` and `vite-plugin-top-level-await`,
   and keep the client interface unchanged. Record the change in `AGENTS.md`.

**Verify**

- `pnpm test` → client test passes.
- `pnpm test:e2e` → `1 passed`; `engine-version` shows `0.1.0`.
- `pnpm build` → exit 0.

**Commit:** `feat: connect the web app to the WASM engine worker`

### P1.5 — Installable PWA shell

**Files**

- `apps/web/vite.config.ts`: add `VitePWA` with `registerType: "autoUpdate"`,
  manifest name/short name `Inlign`, `display: "standalone"`, `start_url: "/"`,
  `theme_color: "#1c1b1f"`, `background_color: "#fffbfe"`, icons 192, 512 and
  maskable 512; Workbox `globPatterns` includes
  `js, css, html, wasm, svg, png, woff2`.
- `apps/web/index.html`: manifest link, `theme-color` meta, apple touch icon.
- `apps/web/public/favicon.svg`: a simple stacked-card monogram in the blue
  accent.
- `apps/web/public/icons/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`, `apple-touch-icon.png`: committed, generated once
  from the SVG.
- `apps/web/src/main.tsx`: `registerSW` from `virtual:pwa-register`.
- `apps/web/src/vite-env.d.ts`: `/// <reference types="vite-plugin-pwa/client" />`.
- `apps/web` dev dependency `vite-plugin-pwa`.

**Verify**

- `pnpm build` → exit 0; `apps/web/dist/sw.js` and
  `apps/web/dist/manifest.webmanifest` exist.
- `node -e "const fs=require('node:fs');const m=JSON.parse(fs.readFileSync('apps/web/dist/manifest.webmanifest','utf8'));if(!m.icons.some(i=>i.sizes==='512x512'))process.exit(1)"`
  → exit 0.
- `pnpm test:e2e` → smoke still passes while served with the service worker.

**Commit:** `feat: make the app an installable PWA`

### P1.6 — CI, AGENTS.md and README

**Files**

- `.github/workflows/ci.yml`: on push to `main` and pull requests; ubuntu-latest;
  steps: checkout, pnpm setup (12), Node 22 with pnpm cache, Rust stable with
  `wasm32-unknown-unknown`, rustfmt and clippy, rust cache, install wasm-pack,
  `pnpm install --frozen-lockfile`, `pnpm build:wasm`, `cargo fmt --check --all`,
  `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test --workspace`, `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check`, `pnpm test`,
  `pnpm --filter @inlign/web exec playwright install --with-deps chromium`,
  `pnpm test:e2e`, `pnpm build`.
- `AGENTS.md`: project summary; command table; architecture boundaries (pure
  Rust core, worker-only WASM, data layer, semantic tokens); hard rules (one
  line per card, no raw hex, no network, no math yet, generated files ignored);
  design record from the spec.
- `README.md`: update for the new project status and real commands. Load the
  `readme` skill before editing; leave the file committed as part of this task.

**Verify**

- `pnpm install --frozen-lockfile` → exit 0.
- The local equivalents of every CI step pass:
  `pnpm build:wasm && cargo fmt --check --all &&
  cargo clippy --workspace --all-targets -- -D warnings &&
  cargo test --workspace && pnpm typecheck && pnpm lint &&
  pnpm format:check && pnpm test && pnpm test:e2e && pnpm build`.
- Every command in `AGENTS.md` and `README.md` exists in `package.json`.

**Commit:** `ci: add full quality gate and project docs`

## Phase 2 — Card notepad

Phase 2 starts only after phase 1 is green. It ends with every success
criterion in the spec met.

### P2.1 — Data layer

**Files**

- `apps/web/src/data/models.ts`: `Line`, `Notebook`, `Theme`, `Accent`,
  `Settings` exactly as in the spec.
- `apps/web/src/data/db.ts`: `InlignDB extends Dexie` with tables
  `notebooks: "id, pinned, sortOrder, updatedAt"` and `settings: "key"`.
- `apps/web/src/data/notebooks.ts`:
  - `createNotebook(title?: string): Promise<Notebook>`
  - `listNotebooks(): Promise<Notebook[]>` (pinned desc, `sortOrder` asc,
    `updatedAt` desc, `id` asc)
  - `getNotebook(id: string): Promise<Notebook | undefined>`
  - `updateNotebook(id: string, patch: Partial<Pick<Notebook, "title" | "lines" | "pinned" | "sortOrder" | "updatedAt">>): Promise<Notebook>`
  - `deleteNotebook(id: string): Promise<void>`
  - `reorderNotebooks(section: "pinned" | "unpinned", orderedIds: string[]): Promise<void>`
- `apps/web/src/data/settings.ts`: `getSettings(): Promise<Settings>`,
  `setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>`;
  defaults `theme: null`, `accent: "blue"`.
- Colocated tests using `fake-indexeddb`.

**Interfaces**

- A new notebook gets `crypto.randomUUID()`, one empty line, `pinned: false`,
  and a `sortOrder` smaller than every unpinned notebook (so it appears first).
- `updateNotebook` always sets `updatedAt` unless the patch supplies one.
- `reorderNotebooks` writes `0..n-1` for the given section in one transaction.

**Verify**

- `pnpm --filter @inlign/web test src/data` → create, list order, update, delete, settings
  round-trip, and reorder tests pass.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: add Dexie notebook and settings repositories`

### P2.2 — Theme tokens, accents and pre-paint

**Files**

- `scripts/generate-accents.mjs`: implements the house OKLCH derivation for six
  accents × three themes and writes
  `apps/web/src/theme/accents.css`; contains `node:assert` checks for the
  documented light/dark primaries.
- `apps/web/src/theme/accents.css`: generated; committed, and listed in
  `.prettierignore` and the ESLint ignores so formatting never fights the
  generator.
- `apps/web/src/theme/tokens.css`: theme neutrals, status colours, night/OLED
  ladders, radii, spacing, control heights and semantic role names.
- `apps/web/src/theme/theme.ts`: `resolveTheme(stored: Theme | null, systemDark: boolean): Theme`,
  `applyTheme(theme: Theme, accent: Accent): void` (sets
  `document.documentElement.dataset.theme`, `dataset.accent`, `color-scheme`).
- `apps/web/src/theme/useTheme.ts`: reads the Dexie setting, falls back to the
  OS, writes the localStorage mirror, and reconciles Dexie as the source of
  truth.
- `apps/web/src/theme/theme.test.ts`: resolve and apply tests.
- `apps/web/src/theme/accents.test.ts`: reads `accents.css` and asserts the six
  documented light and dark primaries plus 18 theme/accent blocks.
- `apps/web/src/styles.css`: Tailwind import plus `@theme inline` mappings from
  semantic variables to utilities (`bg-surface`, `text-on-surface`,
  `rounded-card`, `font-mono`).
- `apps/web/index.html`: inline pre-paint script reading
  `localStorage["inlign.theme"]` and `localStorage["inlign.accent"]`, defaulting
  to `prefers-color-scheme` (Light/Dark, never OLED).
- `apps/web/src/main.tsx`: imports the JetBrains Mono variable font
  (`@fontsource-variable/jetbrains-mono`), `styles.css` and `accents.css`.
- Root script `generate:accents`: `node scripts/generate-accents.mjs`.

**Interfaces**

- Token roles: `background`, `surface`, `surface-container`, `surface-container-high`,
  `on-surface`, `on-surface-variant`, `outline`, `primary`, `on-primary`,
  `primary-container`, `on-primary-container`, `secondary`, `tertiary`,
  `profit`, `loss`, `warning`.
- No component may reference a hex value; only these roles.

**Verify**

- `pnpm generate:accents` then
  `git diff --exit-code -- apps/web/src/theme/accents.css` → no diff.
- `pnpm --filter @inlign/web test src/theme` → both test files pass.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: add house theme tokens and six accent palettes`

### P2.3 — App shell, sidebar and empty state

**Files**

- `apps/web/src/app/AppShell.tsx`: 64 px top bar (sidebar toggle, "Inlign",
  active title, settings button), sidebar region, main editor region.
- `apps/web/src/app/EmptyState.tsx`: centered explanation and primary "New
  notebook" button.
- `apps/web/src/app/App.tsx`: wires the shell, active notebook and empty state.
- `apps/web/src/features/notebooks/NotebookSidebar.tsx`: list, new button,
  desktop collapse and narrow-screen drawer.
- `apps/web/src/features/notebooks/NotebookItem.tsx`: title, pin state, menu
  (rename, pin/unpin, export `.inlign`, delete), inline rename with Enter/blur.
- `apps/web/src/features/notebooks/useNotebooks.ts`: wraps the repository and
  exposes `notebooks`, `activeId`, `select`, `create`, `rename`, `setPinned`,
  `remove`, `reorder`.
- `apps/web/src/ui/`: `Button.tsx`, `IconButton.tsx`, `Dialog.tsx`, `Menu.tsx`,
  `Field.tsx`, `Sheet.tsx` with house radii, 40/48 px targets, visible focus.
- Component tests for create, rename, pin, delete confirmation and empty state.

**Interfaces**

- `useNotebooks()` returns
  `{ notebooks, activeId, select, create, rename, setPinned, remove, reorder }`.
- Delete opens a confirmation dialog; confirming removes the notebook and
  selects the next item or clears `activeId`.
- No notebook is created automatically on first run.

**Verify**

- `pnpm --filter @inlign/web test src/features/notebooks` → sidebar tests pass.
- `pnpm build && pnpm --filter @inlign/web exec playwright test e2e/shell.spec.ts` → create, rename and delete flows pass.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: add notebook sidebar and app shell`

### P2.4 — Card list and line editing

**Files**

- `apps/web/src/features/editor/lineOps.ts`:
  - `type LineOpResult = { lines: Line[]; focus: { lineId: string; offset: number } }`
  - `splitLine(lines, lineId, offset): LineOpResult`
  - `mergeWithPrevious(lines, lineId): LineOpResult | null`
  - `mergeWithNext(lines, lineId): LineOpResult | null`
  - `insertText(lines, lineId, offset, text): LineOpResult`
  - `moveLine(lines, activeId, overId): Line[]`
- `apps/web/src/features/editor/lineOps.test.ts`: split, merge at both ends,
  paste with CRLF, empty text, single-line notebook, move up/down.
- `apps/web/src/features/editor/LineCard.tsx`: card, grip handle, auto-growing
  textarea (`scrollHeight` on input and `ResizeObserver`), `data-line-id`.
- `apps/web/src/features/editor/LineCardList.tsx`: maps lines, keeps focus on
  the card identified by `LineOpResult.focus`, renders at least one card.
- `apps/web/src/features/editor/useNotebookEditor.ts`: local `Line[]` state,
  applies line ops, calls `updateNotebook` on each change, exposes
  `onChange`, `onSplit`, `onMergePrevious`, `onMergeNext`, `onNavigate`,
  `onPaste`.
- `apps/web/src/features/editor/useLineKeys.ts`: Enter, Backspace at 0, Delete
  at end, ArrowUp/Down between cards, paste with newlines.
- Testing Library tests for keyboard behavior and focus.

**Interfaces**

- `LineCard` receives `line`, `index`, `total`, `onAction: (action: LineAction) => void`
  where
  `LineAction = { type: "change"; text: string } | { type: "split"; offset: number } | { type: "merge-previous" } | { type: "merge-next" } | { type: "navigate"; direction: -1 | 1 } | { type: "paste"; offset: number; text: string }`.
- The editor never renders zero cards; a single empty card is valid.

**Verify**

- `pnpm --filter @inlign/web test src/features/editor` → pure line ops and keyboard tests pass.
- `pnpm build && pnpm --filter @inlign/web exec playwright test e2e/editor.spec.ts` → typing, Enter and Backspace
  pass.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: add one-line card editor with line operations`

### P2.5 — Card drag and keyboard reordering

**Files**

- `apps/web/src/features/editor/useCardDnd.ts`: sensors
  (`PointerSensor` distance 4, `TouchSensor` delay 200/tolerance 8,
  `KeyboardSensor` with `sortableKeyboardCoordinates`), `DndContext`,
  `SortableContext` vertical strategy, screen-reader instructions and
  announcements.
- `apps/web/src/features/editor/LineCard.tsx`: `useSortable({ id: line.id })`;
  only the grip handle receives `listeners` and `attributes`; the card keeps
  `transform`/`transition`.
- `apps/web/src/features/editor/LineCardList.tsx`: calls `moveLine` on drop and
  persists immediately.
- `apps/web/e2e/editor-dnd.spec.ts`: mouse drag reorder, keyboard pick up/move/
  drop, focus restored after drop.

**Interfaces**

- Drag activation is handle-only, so selecting text or tapping the textarea
  never starts a drag.
- `onDragEnd` ignores a drop on itself and cancels on Escape.
- The handle has an accessible name (`Move line N`) and a 40 px desktop /
  48 px touch target.

**Verify**

- `pnpm test` → `moveLine` tests pass.
- `pnpm build && pnpm --filter @inlign/web exec playwright test e2e/editor-dnd.spec.ts` → pointer and keyboard reorder
  pass, order survives reload.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: reorder cards with pointer, touch and keyboard`

### P2.6 — Sidebar ordering and pinning

**Files**

- `apps/web/src/features/notebooks/useNotebookDnd.ts`: two `SortableContext`s,
  pinned and unpinned; no cross-section drop.
- `apps/web/src/features/notebooks/NotebookSidebar.tsx`: renders sections,
  calls `reorder(section, orderedIds)` on drop.
- `apps/web/src/features/notebooks/NotebookItem.tsx`: pin/unpin menu action;
  pinned items sort first, then `sortOrder`.
- Tests for section ordering, new-notebook placement and pin persistence.

**Verify**

- `pnpm --filter @inlign/web test src/features/notebooks` → ordering and pin tests pass.
- `pnpm build && pnpm --filter @inlign/web exec playwright test e2e/sidebar-dnd.spec.ts` → drag within a section and pin
  toggle pass; reload preserves order.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: reorder and pin notebooks in the sidebar`

### P2.7 — Autosave and reload persistence

**Files**

- `apps/web/src/lib/debounce.ts`: trailing debounce with `flush()`.
- `apps/web/src/features/editor/useAutosave.ts`: 400 ms debounce per notebook;
  `flush` on blur, `visibilitychange` and `pagehide`; skips the initial render;
  calls `updateNotebook` with lines and `updatedAt`.
- `apps/web/src/features/editor/useNotebookEditor.ts`: structure changes write
  immediately; text changes go through the debounced writer.
- `apps/web/src/features/editor/useAutosave.test.ts`: fake timers assert one
  write per burst and a flush on hide.
- `apps/web/e2e/persistence.spec.ts`: type, wait for the debounce, reload, and
  assert the text returns; also assert switching notebooks mid-burst does not
  lose text.

**Verify**

- `pnpm --filter @inlign/web test src/features/editor/useAutosave.test.ts` → debounce and flush
  tests pass.
- `pnpm build && pnpm --filter @inlign/web exec playwright test e2e/persistence.spec.ts` → reload and notebook-switch
  persistence pass.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: autosave notebook edits and flush on page hide`

### P2.8 — Settings sheet

**Files**

- `apps/web/src/features/settings/SettingsSheet.tsx`: dialog/sheet with
  Appearance and Data sections; opener in the top bar.
- `apps/web/src/features/settings/ThemePicker.tsx`: Light, Dark, OLED segmented
  control; 48 px targets.
- `apps/web/src/features/settings/AccentPicker.tsx`: six swatches with text
  labels, current selection not colour-only.
- `apps/web/src/features/settings/useSettings.ts`: loads settings, writes Dexie
  and the localStorage mirror, applies theme live.
- `apps/web/src/features/settings/settings.test.tsx`: switching updates
  attributes and persists.

**Verify**

- `pnpm --filter @inlign/web test src/features/settings` → picker and persistence tests pass.
- `pnpm build && pnpm --filter @inlign/web exec playwright test e2e/settings.spec.ts` → each theme and accent applies, and
  reload keeps the choice with no `data-theme` mismatch.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: add theme and accent settings`

### P2.9 — `.inlign` export and import

**Files**

- `apps/web/src/data/transfer.ts`: `serializeInlign(notebook)`,
  `parseInlign(text, fallbackTitle)`, `slugify(title)`;
  exports end with no trailing newline, imports normalize CRLF and always
  produce at least one line.
- `apps/web/src/data/transfer.test.ts`: round-trip, CRLF, empty file, filename
  title, 120-character cap.
- `apps/web/src/lib/download.ts`: anchor-based download helper.
- `apps/web/src/features/transfer/useTransfer.ts`: file input, read, create a
  new notebook, surface inline errors.
- `apps/web/src/features/transfer/TransferActions.tsx`: Export active and
  Import `.inlign` actions in the settings Data section and the notebook menu.
- `apps/web/e2e/transfer-inlign.spec.ts`: download, read the suggested filename,
  import it back, assert a new notebook with the same lines.

**Verify**

- `pnpm --filter @inlign/web test src/data/transfer` → serialize and parse tests pass.
- `pnpm build && pnpm --filter @inlign/web exec playwright test e2e/transfer-inlign.spec.ts` → export/import round-trip
  passes and creates a new notebook.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: export and import .inlign notebooks`

### P2.10 — JSON backup and restore

**Files**

- `apps/web/src/data/backup.ts`: zod schema for
  `{ format: "inlign-backup", version: 1, exportedAt, notebooks, settings }`;
  `createBackup(notebooks, settings)`, `parseBackup(unknown)`,
  `withFreshIds(backup)`, `mergeBackup(current, imported)`,
  `BackupError` with a user-facing message.
- `apps/web/src/data/backup.test.ts`: valid/invalid payloads, merge keeps
  unknown notebooks, updates matching ids, add clones ids, replace returns only
  imported records.
- `apps/web/src/features/transfer/ImportDialog.tsx`: counts, Add as new /
  Merge / Replace all; Replace triggers `createBackup` download then a second
  confirmation before writing.
- `apps/web/src/features/transfer/useTransfer.ts`: JSON export and import modes.
- `apps/web/e2e/backup.spec.ts`: add, merge and replace flows; replace
  downloads a safety file before the store changes.

**Interfaces**

- `mergeBackup` keeps current notebooks whose ids are absent from the import.
- `withFreshIds` rewrites notebook and line ids.
- No write occurs until validation and the chosen mode succeed.

**Verify**

- `pnpm --filter @inlign/web test src/data/backup` → schema, merge and clone tests pass.
- `pnpm build && pnpm --filter @inlign/web exec playwright test e2e/backup.spec.ts` → all three import modes pass, and
  Replace downloads the safety backup first.
- `pnpm typecheck` → exit 0.

**Commit:** `feat: add JSON backup and restore with merge or replace`

### P2.11 — Offline PWA and full end-to-end coverage

**Files**

- `apps/web/e2e/pwa.spec.ts`: load, wait for `navigator.serviceWorker.ready`,
  set the context offline, reload, assert the empty state or a saved notebook
  renders.
- `apps/web/vite.config.ts`: confirm `wasm` and `woff2` are in the precache
  glob; exclude nothing needed by the app shell.
- `apps/web/e2e/notepad.spec.ts`: one full journey — create a notebook, type
  three lines, reorder, switch theme, reload, export, import.

**Verify**

- `pnpm build` → exit 0.
- `pnpm test:e2e` → all specs pass, including the offline reload.
- `node -e` manifest check from P1.5 still exits 0.

**Commit:** `test: cover offline PWA and the full notepad journey`

### P2.12 — Final docs and design record

**Files**

- `AGENTS.md`: command table, boundaries, hard rules, and the Design record
  (palette, themes, typeface JetBrains Mono, approved 2026-11-01).
- `README.md`: real commands, prerequisites, port `0.0.0.0:7406`, data and
  backup behaviour, limitations (no math yet, native undo only, ~500 lines,
  iOS storage eviction). Load the `readme` skill before editing.
- `docs/superpowers/specs/2026-11-01-inlign-foundation-design.md`: only if an
  approved change happened; otherwise leave it.
- `.ai-state`: one line summarising the finished milestone (gitignored).

**Verify**

- Every command in `README.md` and `AGENTS.md` exists in `package.json` or
  `Cargo.toml`.
- `pnpm format:check` → exit 0.
- `pnpm test` and `pnpm test:e2e` → pass.
- `git status --short` → only intended files.

**Commit:** `docs: document the card notepad architecture`

## Dependencies / ordering

- P1.1 → P1.2 → P1.3 → P1.4 → P1.5 → P1.6. P1.4 depends on P1.3; P1.5 depends
  on P1.1 and P1.4.
- P2.1 and P2.2 can run in parallel after P1.6. Everything else depends on
  P2.1; the shell (P2.3) also depends on P2.2.
- P2.4 depends on P2.3; P2.5 and P2.7 depend on P2.4; P2.6 depends on P2.3 and
  the ordering repository from P2.1.
- P2.8 depends on P2.2 and P2.3. P2.9 and P2.10 depend on P2.1 and P2.3.
- P2.11 depends on all UI and transfer tasks. P2.12 is last.
- No task starts before the previous phase is green and committed.

## Risks / rollback

- **WASM in a worker:** the riskiest integration. P1.4 proves it before any UI.
  Rollback is `--target web` + `vite-plugin-wasm`, or importing the WASM on the
  main thread behind the same `EngineClient`; the UI never imports the package
  directly, so either rollback is local.
- **Card performance:** 500 textareas plus dnd-kit may stutter. Measure in
  P2.4/P2.5 with a generated notebook; rollback is virtualization or reducing
  auto-grow work, not a data model change.
- **Drag and caret conflicts:** handle-only dragging keeps text selection safe.
  If a problem remains, keep pointer drag and ship keyboard reordering first;
  the data model already supports both.
- **Autosave loss:** flush on blur/visibility/pagehide. If iOS still drops the
  last write, shorten the debounce or write on each structural change; never
  remove the flush.
- **Scope drift:** the engine is a version ping only. Any math work re-opens the
  spec instead of entering a task.
- **Revert:** each task is its own commit; reverting the latest commit returns
  the previous green state. Phase 1 can be reverted without touching phase 2
  data, and vice versa.

## Self-review

- Every spec success criterion maps to a task: 1→P1.1/P2.3, 2→P2.3/P2.6,
  3→P2.4, 4→P2.5, 5→P2.7, 6→P2.9, 7→P2.10, 8→P2.2/P2.8, 9→P2.11,
  10→P1.6/P2.11, 11→P1.3/P1.4, 12→no task adds math.
- Every decision in the spec appears in a task: D25/D30 in P2.4, D27 in P2.5,
  D37 in no task (native undo only), D40 in P1.5, D48 in P2.9, D49 in P2.6,
  D51/D53 in P2.2/P2.10, D55 in P2.2/P2.8, D57/D58/D59/D60/D61/D64/D65 in
  P1.3/P2.1/P2.6/P2.7/P2.9/P2.10.
- Names and signatures are consistent across tasks: `Line`, `Notebook`,
  `Settings`, `LineOpResult`, `EngineClient`, `createBackup` and
  `reorderNotebooks` are defined once and reused.
- Every task has a verification command with an expected result and one commit.
- No open questions.

## Open questions

None.
