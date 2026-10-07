# Inlign — Design Spec

**Status:** Approved
**Date:** 2026-10-07
**Repo:** `github.com/benyamin-git/Inlign` · MIT · v0.1.0

---

## Objective / why

Inlign is a live mathematical notepad: plain text where you draft a solution the way you would
on paper — prose, values, formulas, equations — and a general-purpose math engine computes every
value it can, in place, as you type. Beyond evaluation, Inlign **cross-checks the values you
wrote** against what the rest of the document implies, quietly flags the ones that do not add
up, and offers a one-click fix.

The goal: be the first thing reached for when working through any quantitative problem —
homework, an engineering draft, a budget, an estimate — replacing ad-hoc calculator and
spreadsheet use without forcing spreadsheet structure. Inlign knows no physics or chemistry; it
is a general math engine that turns a written problem into a live, interactive calculation.

Existing notepad calculators (Soulver and its clones) evaluate but do not verify what you wrote;
computer algebra systems solve but demand a special workflow. Inlign combines both: a document
that computes and checks itself.

**Worked example**

```
The ball is dropped from a height of h = 20.
g = 9.81
Fall time: t = sqrt(2 * h / g)
t = 2.1          ← conflict: expected ≈ 2.019       [replace with computed]
Impact speed: v = g * t
v = 20.6
```

Every line is a constraint on one shared system; order does not matter. The claimed `t = 2.1`
is compared against the model, flagged, and fixable in one click.

---

## Success criteria / definition of done

1. A document mixing prose, values, formulas, and equations computes every resolvable value
   inline within ~250 ms of typing pause, smoothly up to ~500 lines.
2. A written value that contradicts the formulas is flagged inline with the expected value and a
   one-click fix; the flag disappears after the fix.
3. Equations with unknowns solve regardless of line order (the document is one constraint
   system), including the nonlinear cases the v1 solver supports; unsupported or non-converging
   cases show a quiet unresolved marker, never a wrong number.
4. Multiple real solutions display inline (up to four, plus a count); complex solutions are out
   of scope in v1.
5. Duplicate definitions with different values are flagged as errors.
6. `%` is a percent literal, `mod(a, b)` is modulo, angles default to radians with a degrees
   setting.
7. Notebooks persist in IndexedDB across reloads; multiple notebooks can be created, switched,
   exported as `.inlign` plain text, and backed up/restored as JSON.
8. The app installs as a PWA on desktop and mobile, works fully offline, and v1 also produces
   Windows, macOS, Linux, and Android artifacts through CI releases.
9. Light, Dark, and OLED themes with six accents ship, first run follows the OS without a
   first-paint flash, and the house-style self-check passes.
10. Quality gates are green in CI: typecheck, lint, engine/data/component unit tests, Playwright
    end-to-end flows, and screenshots; tag pushes deploy the PWA and publish native artifacts.

---

## Scope

### In scope (v1)

- **Document engine** — line classification (prose vs math), parsing, constraint graph, global
  solving (symbolic rearrangement + numeric fallback), claim cross-checking, annotations.
- **Live editor** — CodeMirror 6 with math syntax highlighting, inline results, quiet inline
  errors, conflict decorations with click-to-fix, narrow-screen result placement, native
  editing shortcuts.
- **Notebooks** — multiple documents in IndexedDB (Dexie), autosave, editable titles, last-
  modified ordering, `.inlign` text export/import, JSON backup/restore.
- **Shell & settings** — top bar + full-bleed editor, notebook switcher, settings and help
  sheets, themes/accent, precision, tolerance override, angle mode, data controls.
- **In-app documentation** — Getting started, Syntax reference, How checking works, Engine
  limits, Data & backup.
- **Distribution** — installable PWA (offline), GitHub Pages deploy, Tauri v2 wrappers:
  Windows, macOS, Linux installers + Android APK; release workflow with version tags and
  CHANGELOG; screenshots pipeline.
- **Repo conventions** — full ClyTrade house style (AGENTS.md, masterplan.md, CHANGELOG,
  CONTRIBUTING, docs registry, live.sh, version/bump scripts, tests, CI).

### Non-goals (explicitly out for v1)

- Graphing and plots.
- Units and dimensional analysis (numbers carry no domain meaning).
- Matrices, vectors, complex numbers.
- Scripting constructs: user functions, loops, conditionals.
- LaTeX / MathJax rendering and typeset math.
- Natural-language math ("subtract 5 from 10") and math embedded inside prose sentences
  (whole-line math only; inline segments are a candidate later).
- Physics / chemistry / finance domain logic of any kind.
- Accounts, cloud sync, collaboration, telemetry, any network call after load.
- Persistent revision history, search, print/PDF export, click-to-copy results.

Every non-goal is a deliberate candidate for later versions; the architecture (pure engine,
semantic tokens, registry-driven docs, adapter boundary) must make them additions, not rewrites.

---

## Decision log

| #   | Decision                                                                                                                                                     | Rationale                                                                            | Status  | Source              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------- | ------------------- |
| D1  | General-purpose drafting notepad: user writes formulas **and** values; app computes inline and cross-checks written values                                   | The product's reason to exist; checks for mistakes in a drafted solution             | decided | user                |
| D2  | Symbolic rearrangement **and** numeric solving                                                                                                               | "Solve for unknowns" in both senses                                                  | decided | user                |
| D3  | Full global constraint solving: the whole document is one system, line order irrelevant                                                                      | Powerful drafting; unresolved cases degrade quietly                                  | decided | user                |
| D4  | Success = replaces calculator/spreadsheet for target math                                                                                                    | Concrete definition of done                                                          | decided | user                |
| D5  | Open source, MIT, public GitHub repo                                                                                                                         | Audience and licensing                                                               | decided | user                |
| D6  | `identifier = expr` is a definition/claim; any other `lhs = rhs` is an equation to solve                                                                     | Simple, keyword-free line semantics                                                  | decided | user                |
| D7  | Value conflicts: inline error + expected value + one-click fix; never silent edits                                                                           | User text is sacred; mistakes are easy to fix                                        | decided | user                |
| D8  | Results inline at line end (muted); on narrow screens the result drops to its own indented line                                                              | Keeps the draft readable; never breaks a formula                                     | decided | user                |
| D9  | Multiple real solutions shown inline, up to four plus a count                                                                                                | Complete answers without flooding the line                                           | decided | user                |
| D10 | Unresolved symbols show their symbolic form inline                                                                                                           | Drafting keeps flowing while values are missing                                      | decided | user                |
| D11 | Claim checking respects written precision (claim's last written decimal place; settings can override with a global tolerance)                                | `2.02` for `2.0198` is rounding, not an error                                        | decided | user                |
| D12 | Parse problems are quiet and inline; a malformed line may simply be prose                                                                                    | Notepad, not a compiler                                                              | decided | user                |
| D13 | Try-parse every line; whole-line math only — no math inside prose sentences                                                                                  | Predictable and simple; inline segments deferred                                     | decided | user                |
| D14 | Duplicate definitions with different values are flagged as errors                                                                                            | Stale redefinitions are a common source of silent mistakes                           | decided | user                |
| D15 | `%` is a percent literal (`20%` = 0.20); modulo stays `mod(a, b)`                                                                                            | Calculator intuition; math convention for the rest                                   | decided | user                |
| D16 | Radians default; degrees setting ships in v1                                                                                                                 | Math convention, engineering drafting covered                                        | decided | user                |
| D17 | Smart number display: exact rational when short, else ~12 significant digits, trailing zeros trimmed; precision configurable                                 | Readable by default, exact when exact is cheap                                       | decided | user                |
| D18 | Prose is plain text; only math lines get highlighting and results                                                                                            | No Markdown machinery in v1                                                          | decided | user                |
| D19 | Performance target: smooth to ~500 lines, debounced re-solve (150–250 ms), solving in a Web Worker                                                           | Typing must never stutter                                                            | decided | user                |
| D20 | Delivery: PWA + Tauri v2 wrappers; v1 native artifacts = Windows, macOS, Linux, Android APK; iOS stays PWA                                                   | Matches ClyTrade pattern and "every OS"                                              | decided | user                |
| D21 | React + TypeScript + Vite, mirroring ClyTrade's toolchain (React 19, TS 6, Vite 8, Tailwind 4, Dexie 4, zod 4, vitest 5, Playwright, ESLint 10, Prettier 3)  | Proven in the author's other project; easy contribution                              | decided | user                |
| D22 | Nerdamer 2.0.0 behind Inlign's own CAS adapter interface                                                                                                     | The only mature JS CAS with symbolic + numeric solving; adapter keeps it replaceable | decided | user                |
| D23 | CodeMirror 6, direct integration (no React wrapper), inline widget decorations; solving in a Web Worker                                                      | Purpose-built for inline results; full control; no wrapper lock-in                   | decided | user                |
| D24 | Persistence: IndexedDB multi-notebook via Dexie; `.inlign` text export/import; JSON backup/restore                                                           | Local-first, mirrors ClyTrade data approach                                          | decided | user                |
| D25 | English only in v1, typed-dictionary i18n seam in place                                                                                                      | Avoids retrofit; no second locale to maintain yet                                    | decided | user                |
| D26 | License MIT                                                                                                                                                  | As requested; compatible with Apache-2.0 Nerdamer                                    | decided | user                |
| D27 | Full ClyTrade repo conventions: AGENTS.md, masterplan.md, CHANGELOG, CONTRIBUTING, in-app docs registry, live.sh, version/bump scripts, screenshots pipeline | One house style across the author's projects                                         | decided | user                |
| D28 | CI/CD: GitHub Pages PWA deploy + tag-driven release workflow with native artifacts and CHANGELOG                                                             | Proven ClyTrade approach                                                             | decided | user                |
| D29 | Testing ladder: table-driven engine tests, component tests (Testing Library + fake-indexeddb), Playwright e2e + screenshots                                  | Trustworthy engine is the product; UI flows must be proven                           | decided | user                |
| D30 | Settings v1: precision & formatting, tolerance override, theme, accent, angle mode, backup export/import                                                     | Everything users need in one place                                                   | decided | user                |
| D31 | Identity: Inlign · package `inlign` · `com.inlign.app` · v0.1.0 · LAN dev port 7406                                                                          | Confirmed                                                                            | decided | user                |
| D32 | Single-notebook export format: `.inlign` UTF-8 plain text                                                                                                    | Readable, diffable, future-proof                                                     | decided | user                |
| D33 | In-app docs pages: Getting started, Syntax reference, How checking works, Engine limits, Data & backup                                                       | Explain the why, not just the how                                                    | decided | user                |
| D34 | Minimal shortcut set: new notebook, notebook switcher, export, settings (plus editor-native undo/redo)                                                       | Small surface for v1                                                                 | decided | user                |
| D35 | Default accent blue; all six house accents selectable                                                                                                        | House style                                                                          | decided | user + design skill |
| D36 | Type: IBM Plex Sans (UI) + IBM Plex Mono (editor), one superfamily                                                                                           | Aligned equations, one-family rule satisfied                                         | decided | user + design skill |
| D37 | Shell: 64 px top bar (title, switcher, actions) + full-bleed editor; settings/help as sheets                                                                 | Simple, editor-first, mobile-friendly                                                | decided | user                |
| D38 | Themes Light / Dark / OLED; first run follows OS for Light/Dark; OLED opt-in; no first-paint flash; accessibility floor and the twelve bans are hard rules   | House style                                                                          | decided | design skill        |
| A1  | No backend: fully client-side, no accounts, no sync, no telemetry, no network calls after load                                                               | User delegated the backend choice; local-first matches the product and privacy story | assumed | recommendation      |
| A2  | Nerdamer pinned exactly at 2.0.0; caret ranges elsewhere, matching ClyTrade                                                                                  | 2.x is young; the adapter keeps an escape hatch                                      | assumed | recommendation      |
| A3  | When definitions conflict, the first definition is authoritative; later conflicting lines are the ones flagged, with the first value as the fix suggestion   | "Flag duplicates as errors" needs a deterministic expected value                     | assumed | recommendation      |
| A4  | First run seeds a welcome notebook with worked examples                                                                                                      | Teaches the core loop without a manual                                               | assumed | recommendation      |
| A5  | Placeholder brand icon generated by script (ClyTrade pattern)                                                                                                | Branding is not the v1 problem; swap later                                           | assumed | recommendation      |
| A6  | macOS/Linux artifacts unsigned in v1; signing/notarization deferred and documented                                                                           | Signing needs paid accounts and CI secrets                                           | assumed | recommendation      |
| A7  | Autosave debounced; notebook list ordered by last edit; titles edited in the top bar                                                                         | Conventional, frictionless                                                           | assumed | recommendation      |
| A8  | `.inlign` files carry no metadata; the title comes from the filename on import                                                                               | Plain text stays plain                                                               | assumed | recommendation      |

Status values: `decided` (user answered), `assumed` (user delegated; flagged for review).

---

## Architecture

### Overview

```
┌──────────────────────────────────────────────────────────────┐
│  App shell (React)                                           │
│  top bar · notebook switcher · settings/help sheets           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ CodeMirror 6 editor                                    │  │
│  │  syntax highlighting · inline result/error widgets     │  │
│  │  conflict decorations + click-to-fix command           │  │
│  └────────────────────────────────────────────────────────┘  │
│         ▲ annotations (line ranges)        │ document text    │
│         │                                  ▼                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Web Worker                                             │  │
│  │  engine: classify → parse → constraints → solve →      │  │
│  │          check claims → annotations                    │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ CAS adapter  →  Nerdamer 2.0.0                   │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│  Data layer: Dexie (notebooks, settings, backup)              │
│  PWA shell · Tauri v2 wrappers                                │
└──────────────────────────────────────────────────────────────┘
```

### Engine (pure, protected)

`src/engine/**` is pure TypeScript — no React, DOM, Dexie, or i18n imports — mirroring ClyTrade's
protected calculations rule. It is the product; its tests are the contract.

Pipeline for a document:

1. **Classify** each line: blank, prose/comment (`#` prefix always prose), or a statement.
   A line that fails to parse is prose, silently.
2. **Parse** statements through the CAS adapter into expression IR:
   - _Claim_ — `name = constant-expression` (no free symbols): a value the user asserts.
   - _Definition/formula_ — `name = expression` with free symbols: a constraint.
   - _Equation_ — non-identifier LHS: `2*x + 3 = 11`, solved for its unknowns.
   - _Expression_ — bare math: evaluated and shown, no binding.
3. **Build the constraint system**: symbols → statements; duplicate definitions detected here
   (D14, A3).
4. **Resolve** values:
   - substitute known values / propagate;
   - single unknown on a line → symbolic rearrangement, numeric fallback with bounded root
     finding;
   - coupled unknowns → system solving (exact for linear and supported polynomial forms,
     numeric best-effort for nonlinear/transcendental, iteration-capped);
   - underdetermined symbols stay symbolic (D10); non-convergence and unsupported forms become
     a quiet unresolved marker.
5. **Check claims** against the resolved model using written-precision tolerance (D11):
   each unsatisfied claim yields a conflict annotation carrying the expected value and the text
   range to replace.
6. **Format** numbers (D17) and emit annotations: `result`, `conflict`, `error`, `unresolved`.

Annotations are the only engine output the UI consumes; they are virtual and never mutate the
document text. Click-to-fix issues a normal CodeMirror transaction (undoable), and the next
solve pass clears the flag.

### CAS adapter

A narrow interface (`parse`, `evaluate`, `solveFor`, `solveSystem`, `simplify`, `substitute`)
implemented by a Nerdamer adapter in `src/engine/cas/`. The engine depends only on the
interface. Degrees mode is applied at the adapter boundary (trig argument handling). Swapping to
nerdamer-prime, Nerdamer 1.x, or another CAS later is an adapter-sized change (A2).

### Worker protocol

The worker owns the engine. The UI sends `{docVersion, text}` after a 150–250 ms debounce; the
worker replies `{docVersion, annotations}`. Stale responses are dropped by version. Solving
never blocks typing (D19).

### Editor integration

- Math syntax highlighting for statement lines; prose stays plain (D18).
- Inline decorations: muted `= result` widget at line end; on narrow screens a block widget on
  the next line, indented (D8).
- Conflicts: loss-colored underline + short inline message; hover/tap reveals detail; the
  suggestion is applied by click or keyboard (D7).
- Errors and unresolved markers are quiet, inline, and non-modal (D12).

### UI shell

Top bar (64 px) with notebook title, notebook switcher, and actions (new, export, settings,
help); the editor fills the window; settings and help open as sheets. Minimal shortcut set
per D34. Notebooks autosave; the list orders by last edit (A7). The shell is intentionally
mobile-first-capable: same structure, 48 px touch targets.

### Design (house style, per `/design` skill)

- **Palette**: semantic MD3-style roles only; six accents generated in OKLCH from the house
  seeds (blue default), one active at a time; status colors (loss for conflicts, warning for
  unresolved) are not accents.
- **Themes**: Light / Dark / OLED, switched before first paint; first run follows
  `prefers-color-scheme`; OLED opted in from settings; `color-scheme` set to match.
- **Type**: IBM Plex Sans for UI, IBM Plex Mono for the editor — one superfamily; closed scale
  12/14/16/20/24/32; body 14–16 px; prose measure ≤ ~80 ch.
- **Density**: 40 px desktop controls / 48 px touch; 36 px rows; 64 px top bar; 4 px spacing
  steps; house radii (6/8/12/16/full).
- **Layout**: mobile and desktop designed on purpose; one accent per screen; results and status
  never rely on color alone.
- **Hard floor**: the twelve bans and the six accessibility items apply to every screen in all
  three themes; the design skill's self-check runs before any UI work is reported done.
- This spec's approval covers the design-note gate; the `## Design` record is written into
  `AGENTS.md` at implementation start.

### Data layer

Dexie database (v1): `notebooks {id, title, content, createdAt, updatedAt}` and
`settings {key, value}`. Repository modules own all reads/writes; components read with
`useLiveQuery` (cross-tab updates come from Dexie). Zod models validate on import and backup
restore. Backup is a versioned JSON envelope (`schemaVersion`, notebooks, settings) so future
migrations have a seam. `.inlign` export is the notebook's raw text (D32, A8).

### Distribution

- **PWA**: `vite-plugin-pwa` auto-update, offline caching, installable, icons generated by
  script; deployed to GitHub Pages under the repo base path.
- **Tauri v2**: version read from `package.json`; bundle targets — Windows NSIS, macOS, Linux
  AppImage/deb — plus a committed Android project producing an APK; minimal capabilities
  (file open/save dialogs). iOS is PWA-only in v1 (D20).
- **Release**: tag-driven GitHub Actions workflow builds web + natives, collects artifacts,
  publishes a release with the CHANGELOG entry; `version:set` bumps package/lockfiles/Cargo.

### Security & privacy

No accounts, no network calls after load, no analytics. User text is data: expressions are
parsed by the CAS, never `eval`'d. A restrictive CSP is set for the PWA. Backups and exports
stay on the device unless the user moves them.

---

## Risks + rollback

| Risk                                                 | Mitigation                                                                          | Rollback                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Nerdamer 2.x is young and its docs/API can shift     | Adapter isolates it; golden engine tests; exact pin (A2)                            | Swap adapter to nerdamer-prime/1.x or another CAS behind the same interface |
| Global nonlinear solving is not always possible      | Documented engine limits; quiet unresolved markers; never emit a guessed number     | Ship per-line solving as fallback mode if system solving proves unreliable  |
| Worker + editor annotation plumbing is fiddly        | Phased build: engine first with tests, then worker, then editor; protocol is tiny   | Run engine on main thread behind the same protocol if the worker path fails |
| Writing-precision tolerance surprises users          | One settings override (D30); docs page explains the rule                            | Switch default to global tolerance setting                                  |
| Unsigned macOS/Windows artifacts trigger OS warnings | Documented in release notes; PWA remains a first-class path                         | Users install the PWA; signing added later                                  |
| Mobile editing with a device keyboard is awkward     | Narrow-screen result layout; ≥16 px editor text (no zoom); no custom keyboard in v1 | Defer Android artifact; PWA still works                                     |

Rollback for deployment is trivial: Pages can be reverted to any earlier commit; native builds
are released artifacts, never auto-updated. User data lives only on-device with export/backup
available before any risky change.

---

## Dependencies / ordering

1. **Engine core + CAS adapter + golden tests** — proves the product's core value with no UI.
2. **Worker protocol + formatting** — the engine becomes usable asynchronously.
3. **Data layer** (Dexie, repositories, backup) — independent of the engine; can proceed in
   parallel.
4. **Editor integration** (CodeMirror, annotations, click-to-fix) — first real UX.
5. **Shell, settings, docs, i18n seam** — completes the app.
6. **PWA + Tauri wrappers + CI/releases** — packaging and distribution.
7. **Docs polish, screenshots, v0.1.0 release.**

External dependencies: Nerdamer 2.0.0 (Apache-2.0); CodeMirror 6 packages; React/TS/Vite/
Tailwind/Dexie/zod/vitest/Playwright/ESLint/Prettier mirroring ClyTrade; Tauri v2 toolchain;
GitHub Actions and Pages; Google Fonts sources for IBM Plex via `@fontsource` packages.

---

## Open questions

None. Planning is complete when the spec is approved; the implementation plan follows.
