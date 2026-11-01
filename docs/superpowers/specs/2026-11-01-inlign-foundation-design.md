# Inlign Foundation and Card Notepad — Design Spec

**Status:** Approved
**Date:** 2026-11-01

## Objective / why

Build the foundation of Inlign from scratch: a pnpm/Rust workspace, a React PWA
shell, and a local-first notepad whose document is a list of one-line cards that
can be dragged into a new order. The math engine is explicitly deferred; only a
`version()` call crosses the Rust/WASM boundary to prove the pipeline works.

The outcome is a usable plain-text notepad that persists in IndexedDB, installs
as an offline PWA, and has a structure the math engine can be added to without a
rewrite.

## Success criteria / definition of done

1. `pnpm install` then `pnpm dev` serves the app on `0.0.0.0:7406` with a strict
   port, and the first run shows an empty state with a "New notebook" action.
2. A notebook can be created, renamed inline in the sidebar, pinned, reordered
   by drag, and deleted after confirmation. All of it survives a reload.
3. The editor shows one draggable card per logical line. Cards can be added with
   Enter, merged with Backspace/Delete, split by pasting multi-line text, and
   navigated with arrow keys.
4. Dragging works with mouse, touch and keyboard (pick up, move, drop, cancel).
5. Text edits are autosaved and restored after a reload, including after a tab
   close.
6. Notebooks export as `.inlign` plain text and import back as new notebooks.
7. A JSON backup can be added as new, merged by id, or replaced wholesale; a
   replace downloads a safety backup first and requires confirmation.
8. Light, Dark and OLED themes and the six accents switch without a first-paint
   flash and persist across reloads.
9. The production build installs as a PWA and reloads offline after the first
   visit.
10. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
    `pnpm test:e2e`, `pnpm build`, `cargo fmt --check`, `cargo clippy` and
    `cargo test` all pass, and the GitHub Actions workflow runs them.
11. The Rust worker answers the `version()` request, proving wasm-pack, Vite,
    the worker and the generated TypeScript types all work together.
12. No math evaluation, parsing, highlighting, solving or checking exists in
    this milestone.

## Scope

### In scope

- pnpm workspace with `apps/web`, `crates/engine`, `crates/engine-wasm` and the
  generated `packages/engine-wasm` package.
- React 19 + TypeScript + Vite 8 + Tailwind 4 web app.
- Rust core crate and thin `#[wasm_bindgen]` facade, built with wasm-pack.
- Web Worker adapter with a request/response protocol.
- IndexedDB persistence with Dexie 4.
- Card editor with one line per card, textarea editing, full line operations and
  dnd-kit reordering.
- Sidebar notebook list, empty state, inline rename, pin/unpin, delete.
- `.inlign` text import/export and versioned JSON backup/restore.
- Theme and accent settings with Light/Dark/OLED and six accents.
- Installable, offline PWA.
- ESLint, Prettier, Vitest, Playwright, cargo fmt/clippy/test, GitHub Actions.
- `AGENTS.md`, README commands, and the design record.

### Non-goals (explicitly out)

- Any math work: line classification, parsing, constraint graph, solving,
  symbolic algebra, numeric fallback, claim checking, results or conflicts.
- Math syntax highlighting or inline results in cards.
- Settings beyond theme and accent (precision, tolerance, angle, data controls).
- Native wrappers (Tauri, desktop, Android, iOS).
- Accounts, sync, telemetry, and any network call after load.
- Deployment, release workflow, versioning, or GitHub Pages.
- i18n, locale switching or a strings module; English is hard-coded.
- Structural undo; only the textarea's native undo exists.
- List virtualization, multi-line selection across cards, find/replace, folders,
  tags, images or rich text.
- Keyboard shortcuts beyond the line-editing keys defined here.

## Decision log

| # | Decision | Rationale | Status | Source |
| --- | --- | --- | --- | --- |
| D1 | One spec and a two-phase implementation plan: scaffold first, card notepad second | Keeps the boundary and the UI independently verifiable | decided | user |
| D2 | TypeScript + Rust, with the math core in Rust compiled to WASM | Rust for the future engine, TypeScript for the product surface | decided | user |
| D3 | Build fully from scratch; do not reuse or read the legacy implementation | Clean rebuild without inherited structure | decided | user |
| D4 | v1 is a web PWA only; native wrappers are out | Smallest shippable surface | decided | user |
| D5 | pnpm with Node 22 | Installed toolchain, faster workspace installs | decided | user |
| D6 | Spec and plan live under `docs/superpowers/` | Established convention | decided | user |
| D7 | Rust owns all math: classification, parsing, constraints, solving, checking, formatting; TS owns editor, storage, UI | One narrow WASM boundary, testable core | decided | user |
| D8 | Monorepo: `apps/web`, `crates/engine`, `crates/engine-wasm` | Clear package boundaries | decided | user |
| D9 | Pure Rust core separated from thin WASM bindings | `cargo test` works natively; core stays portable | decided | user |
| D10 | wasm-pack `--target bundler` | Vite 8 consumes the output without an extra plugin | decided | user |
| D11 | Engine runs in a dedicated Web Worker | Typing must never block on solving | decided | user |
| D12 | Test gates: cargo test, Vitest, Playwright | One gate per layer | decided | user |
| D13 | React 19 | Matches the author's other projects; ecosystem | decided | user |
| D14 | Tailwind v4 | House token and density system fits | decided | user |
| D15 | Generated WASM consumed as `packages/engine-wasm` workspace package | Explicit dependency boundary, generated files out of git | decided | user |
| D16 | ESLint 10 flat config + Prettier 3 | Familiar, conventional | decided | user |
| D17 | Dev server binds `0.0.0.0:7406` with `--strictPort` | Dashboard already allocates `inlign: 7406` | decided | user |
| D18 | One spec, two plan phases: scaffold, then UI/notepad | Incremental implementation | decided | user |
| D19 | Multiple notebooks with `.inlign` and JSON import/export | A notepad needs more than one document and a backup path | decided | user |
| D20 | IndexedDB via Dexie 4 | Local-first, scales past localStorage | decided | user |
| D21 | Rust scaffold exports a trivial `version()` | Proves the whole pipeline without math | decided | user |
| D22 | ~~CodeMirror 6 editor~~ | Superseded by D25; card layout makes a single surface unfit | superseded | user |
| D23 | House design system | Consistent personal style | decided | user |
| D24 | One logical line per card | Clear, draggable unit that later carries a result | decided | user |
| D25 | Auto-growing textarea per card | Native caret, IME, paste and mobile behavior; CodeMirror per card is too heavy | decided | user |
| D26 | Ordered line array is the stored document | Drag reorders the array; export joins lines | decided | user |
| D27 | dnd-kit sortable with grip handle and keyboard sensor | Accessible drag on mouse, touch and keyboard | decided | user |
| D28 | Full line editing: Enter, Backspace merge, Delete merge, paste split, arrow navigation | A line editor must behave like one | decided | user |
| D29 | House palette and themes with the card layout; no new palette | Only the layout changes | decided | user |
| D30 | Lines are `{ id, text }` objects with stable UUIDs | Correct drag, focus and future annotations | decided | user |
| D31 | Notebooks store `pinned` and an explicit `sortOrder` | Manual order and pinning without a migration | decided | user |
| D32 | Sidebar notebook navigation, sheet on narrow screens | Scales to many notebooks | decided | user |
| D33 | Import lets the user choose add, merge or replace | User controls destructive imports | decided | user |
| D34 | Settings limited to theme and accent | No engine settings exist yet | decided | user |
| D35 | Feature-first folders with repository hooks over Dexie; no global store | Small app, clear data layer | decided | user |
| D36 | Import dialog with Add as new / Merge / Replace all | Explicit choice at import time | decided | user |
| D37 | Native textarea undo only; no structural undo | User kept the smallest behavior; drag/merge mistakes are not undoable | decided | user |
| D38 | No URL router | Active notebook is app state | decided | user |
| D39 | No virtualization; target ~500 cards, measure later | Avoid premature complexity | decided | user |
| D40 | Installable PWA in this milestone | Offline use is a core product property | decided | user |
| D41 | Evergreen Chrome, Edge, Firefox, Safari and iOS Safari 17+ | Includes LAN phone testing | decided | user |
| D42 | `@inlign/web`, `@inlign/engine-wasm`; `inlign-engine`, `inlign-engine-wasm` | Clear ownership and generated-package boundary | decided | user |
| D43 | Maximum TypeScript strictness | Catch data and null edges early | decided | user |
| D44 | Caret ranges with committed `pnpm-lock.yaml` and `Cargo.lock` | Reproducible installs with normal upgrades | decided | user |
| D45 | Full GitHub Actions gate | Public repo, every layer verified | decided | user |
| D46 | Scaffold includes `AGENTS.md` and README commands | Future sessions start informed | decided | user |
| D47 | Hard-coded English, no strings module | Smallest surface; i18n is a later rewrite | decided | user |
| D48 | `.inlign` import always creates a new notebook | Plain text carries no id, so merge is impossible | decided | user |
| D49 | Sidebar order is pinned first, then manual `sortOrder`; drag reorders | Matches the chosen data model | decided | user |
| D50 | First run shows an empty state; no notebook is auto-created | No surprise documents | decided | user |
| D51 | JetBrains Mono as the single typeface | User choice; one family satisfies the house rule | decided | user |
| D52 | Notebook titles rename inline in the sidebar | Direct manipulation, less chrome | decided | user |
| D53 | zod 4 validates imported JSON and `.inlign` data | Imports are a trust boundary | decided | user |
| D54 | `dev`/`build` run the WASM build first; `pkg/` is gitignored | Generated code never drifts or enters git | decided | user |
| D55 | Theme and accent live in Dexie, mirrored to localStorage for pre-paint | Correct source of truth with no flash | decided | user |
| D56 | Replace-all restore auto-downloads a backup, then confirms | Destructive import has a recovery path | decided | user |
| D57 | Generated WASM package has a committed `package.json` shim | Keeps pnpm workspace install valid before the first build | assumed | recommendation |
| D58 | Autosave debounce 400 ms; flush on blur, `visibilitychange` and `pagehide` | Bounds writes without risking data loss | assumed | recommendation |
| D59 | A new notebook is inserted at the top of its sidebar section; pinning is only via the item menu; drag does not cross sections | Predictable ordering with the chosen `pinned`/`sortOrder` model | assumed | recommendation |
| D60 | JSON backup shape is `{ format, version, exportedAt, notebooks, settings }`, version 1 | Versioned, self-describing backup | assumed | recommendation |
| D61 | `.inlign` exports lines joined with `\n` and no trailing newline; imports normalize CRLF; title comes from the filename | Portable plain text | assumed | recommendation |
| D62 | PWA icons are a simple committed monogram set generated once from an SVG | PWA needs icons; no icon design work in this milestone | assumed | recommendation |
| D63 | Tooling defaults: typescript-eslint, react-hooks, react-refresh, jsx-a11y; Prettier `printWidth` 100; Rust edition 2024, MSRV 1.85; CI on ubuntu-latest with Chromium | Conventional, low-risk defaults | assumed | recommendation |
| D64 | Settings table is key/value (`key`, `value`) | Extends to future settings without schema churn | assumed | recommendation |
| D65 | If IndexedDB is unavailable, the app stays usable in memory and shows a persistent warning | Avoids a blank app; never silently loses data | assumed | recommendation |

## Architecture

### Repository layout

```text
Inlign/
  apps/web/                     React PWA
    public/                     favicon, PWA icons
    src/
      app/                      App, shell, empty state
      data/                     Dexie db, models, repositories, backup schemas
      engine/                   worker client, protocol, worker
      features/
        notebooks/              sidebar, item, hooks
        editor/                 card list, card, line ops, drag, autosave
        settings/               settings sheet, theme and accent pickers
        transfer/               import dialog, export/import hooks
      theme/                    tokens.css, accents.ts, generated accents.css
      ui/                       Button, IconButton, Dialog, Sheet, Field, Menu
      lib/                      id, debounce, download
      main.tsx
    index.html
    vite.config.ts
    tsconfig*.json
    package.json
  crates/
    engine/                     pure Rust, no wasm-bindgen
    engine-wasm/                #[wasm_bindgen] facade
  packages/
    engine-wasm/                committed package.json shim; generated pkg/ ignored
  scripts/
    build-wasm.mjs              deterministic wasm-pack invocation
    generate-accents.mjs        writes apps/web/src/theme/accents.css
  docs/superpowers/
  .github/workflows/ci.yml
  Cargo.toml                    Rust workspace
  pnpm-workspace.yaml
  package.json                  root scripts
  AGENTS.md
  README.md
```

### Runtime shape

```text
React UI
  -> repository hooks (data/)
  -> Dexie (IndexedDB)          notebooks, settings
  -> engine client (engine/)    request id, promise map
       -> Web Worker
            -> @inlign/engine-wasm
                 -> inlign-engine (pure Rust)
```

The engine is a leaf: it never imports React, Dexie, DOM, or theme code. The
worker imports only the generated WASM package and the protocol types.

### Data model

```ts
type Line = { id: string; text: string };

type Notebook = {
  id: string;          // crypto.randomUUID()
  title: string;       // trimmed, max 120 chars
  lines: Line[];       // source of truth; at least one line
  pinned: boolean;
  sortOrder: number;   // manual order within the pinned or unpinned section
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
};

type Theme = "light" | "dark" | "oled";
type Accent = "blue" | "teal" | "green" | "orange" | "rose" | "violet";
type Settings = { theme: Theme | null; accent: Accent }; // null = follow OS
```

Dexie database `inlign`, version 1:

- `notebooks`: primary key `id`; indexes `pinned`, `sortOrder`, `updatedAt`.
- `settings`: primary key `key`; rows such as `{ key: "theme", value: "dark" }`.

Missing `theme` means follow `prefers-color-scheme`; picking a theme writes it.
The accent defaults to `blue`.

### Engine boundary

Phase 1 protocol only:

```ts
type EngineRequest = { id: number; type: "version" };
type EngineResponse =
  | { id: number; type: "version"; version: string }
  | { id: number; error: string };
```

The client owns a pending-promise map keyed by `id`, and the worker never throws
across the boundary. Later math requests are additions to this protocol, not
replacements. The UI never imports the generated package directly.

### Line editing behavior

- **Enter** splits the current line at the caret into a new card below; focus
  starts the new card.
- **Backspace at offset 0** merges the line into the previous card at its end and
  places the caret at the join.
- **Delete at end of line** merges the next card into the current one and keeps
  the caret.
- **Paste with newlines** splits the pasted text across cards; the first part
  joins the text before the caret and the last part joins the text after it.
- **Arrow Up/Down** moves between cards when the caret is on the first/last
  visual row, preserving the column where possible.
- **Drag** uses a visible grip handle; dnd-kit keyboard sensor supports Space or
  Enter to pick up, arrows to move, Space or Enter to drop, Escape to cancel.
- Empty lines are real cards. A notebook always has at least one line.

Line operations are pure functions over `Line[]`, unit-tested without React.

### Autosave

Text edits debounce for 400 ms per notebook. Line structure changes, drag drops,
title commits, pin toggles and deletes write immediately. Pending writes flush on
blur, `visibilitychange` and `pagehide`. `updatedAt` changes only on content or
title edits, not on pin or order changes.

### Sidebar and shell

- 64 px top bar: sidebar toggle, "Inlign", active notebook title, settings button.
- 280 px sidebar on desktop, collapsible; overlay drawer on narrow screens.
- Each item: title, pinned indicator, menu (rename, pin/unpin, export `.inlign`,
  delete). Delete requires confirmation.
- Order: pinned first, then `sortOrder` ascending, `updatedAt` descending as a
  tiebreak. New notebooks go to the top of the unpinned section.
- First run: empty state with a primary "New notebook" action. Deleting the
  active notebook selects the next item or returns to the empty state.

### Theme system

- Semantic CSS custom properties only; components never use raw hex.
- Light/Dark/OLED and six accents generated in OKLCH by
  `scripts/generate-accents.mjs` into `apps/web/src/theme/accents.css`, following
  the house derivation and gamut-clipping rules.
- An inline pre-paint script in `index.html` reads the localStorage mirror, sets
  `data-theme` and `data-accent` on `<html>` and sets `color-scheme`. Dexie stays
  the source of truth; after settings load, it reconciles the mirror.
- First run follows `prefers-color-scheme`; OLED is opt-in only.

### Import and export

- **Export notebook**: UTF-8 `.inlign`, lines joined with `\n`, no trailing
  newline. Filename is the slugified title.
- **Import `.inlign`**: always creates a new notebook; title from the filename,
  capped at 120 characters; empty files become one empty line.
- **Backup JSON**: `{ format: "inlign-backup", version: 1, exportedAt,
  notebooks, settings }`, validated with zod.
- **Import JSON**: dialog offers Add as new (clone with fresh ids), Merge
  (update matching ids, add unknown, keep the rest), or Replace all (download a
  safety backup first, then confirm).
- Imported text is rendered as text only. Invalid files produce an inline error
  naming the problem; nothing is written until validation passes.

### PWA

`vite-plugin-pwa` with `autoUpdate`, a manifest, and precaching of the app shell,
WASM, fonts and icons. No runtime caching of remote requests because there are
none. Theme colour follows the active theme where the manifest allows it; the
static manifest uses the Dark background.

### Quality gates

- Rust: `cargo fmt --check`, `cargo clippy --workspace --all-targets --
  -D warnings`, `cargo test --workspace`.
- TypeScript: `tsc -b` with maximum strictness, ESLint, Prettier check, Vitest.
- Browser: Playwright covering create/rename/delete, line editing keys, drag
  with mouse and keyboard, persistence after reload, theme switch, import/export
  and a narrow viewport.
- CI runs the same commands on `ubuntu-latest` with Node 22, pnpm 12, Rust stable,
  the `wasm32-unknown-unknown` target and wasm-pack. Playwright uses Chromium.

## Design note

Required by the house design skill before UI code; spec approval covers it.

- **Palette:** house six accents, blue default; semantic roles for surfaces,
  text, outline and status. No raw hex in components.
- **Themes:** Light / Dark / OLED; first run follows the OS; OLED opt-in; no
  first-paint flash.
- **Type:** JetBrains Mono as the single family, self-hosted; scale 12/14/16/20/
  24/32 px; body and cards 16 px.
- **Layout:** 64 px top bar; 280 px collapsible sidebar; cards constrained to
  ~72ch and 8 px apart; 12 px card radius; 40 px desktop and 48 px touch targets.
- **Cards:** `surface-container` background, outline separation, no shadows, grip
  handle on the left, focus ring on the card and handle.
- **Accessibility floor:** 4.5:1 body contrast in all themes, visible focus,
  semantic controls, keyboard drag, no colour-only meaning.
- **Approved:** 2026-11-01 (spec approval).

## Risks and rollback

| Risk | Mitigation / rollback |
| --- | --- |
| wasm-pack `bundler` output inside a Vite worker fails to load | Prove it in phase 1; fall back to `--target web` with `vite-plugin-wasm`, keeping the same client interface |
| 500 card textareas plus dnd-kit stutter | Measure with a generated 500-line notebook; add virtualization or reduce auto-grow work; virtualization is the planned upgrade |
| Drag breaks textarea focus or caret | Keep drag tied to the handle only; test mouse, touch and keyboard; restore focus on drop |
| Native-only undo cannot revert drag or merge | Accepted by the user; destructive notebook actions require confirmation |
| Autosave loses the last keystrokes on close | 400 ms debounce plus flush on blur, `visibilitychange` and `pagehide` |
| Theme flash on load | localStorage mirror applied by an inline pre-paint script; Dexie reconciles afterwards |
| JSON restore destroys data | Mandatory automatic backup download plus confirmation before replace |
| iOS evicts IndexedDB storage | Backup export available; document the limitation in the README |
| JetBrains Mono everywhere hurts long prose | User choice; card measure capped at ~72ch and body size at 16 px |

## Dependencies / ordering

- Phase 1 (scaffold) must land before phase 2 (notepad UI).
- Phase 1: workspace config, Rust crates, WASM build, web shell, worker version
  ping, lint/format/typecheck, CI, docs.
- Phase 2 order: data layer and settings storage -> theme tokens and pre-paint ->
  shell and sidebar -> card rendering and line operations -> drag and keyboard
  reordering -> autosave wiring -> settings sheet -> import/export -> PWA and
  end-to-end coverage.
- External prerequisites: Node 22, pnpm 12, Rust stable with
  `wasm32-unknown-unknown`, wasm-pack, and Playwright Chromium.

## Open questions

None.
