# Inlign — Masterplan

The distilled product direction. The approved design spec —
`docs/superpowers/specs/2026-10-07-inlign-design.md` — is the source of truth;
this file is what agents and contributors read first.

## What Is It

Inlign is a live mathematical notepad: a plain-text document where you draft a
solution the way you would on paper — prose, values, formulas, equations — and a
general-purpose math engine computes every value it can, in place, as you type.

Beyond evaluation, Inlign **cross-checks the values you wrote** against what the
rest of the document implies, quietly flags the ones that do not add up, and
offers a one-click fix.

## Why It Exists

Calculators make you think in one expression at a time. Spreadsheets make you
think in cells. Neither lets you draft the way you think: a page of notes with
values and formulas, revised as you go.

Existing notepad calculators evaluate but do not verify what you wrote; computer
algebra systems solve but demand a special workflow. Inlign combines both: a
document that computes and checks itself.

```
The ball is dropped from a height of h = 20.
g = 9.81
Fall time: t = sqrt(2 * h / g)
t = 2.1          ← conflict: expected ≈ 2.019       [replace with computed]
Impact speed: v = g * t
v = 20.6
```

Every line is a constraint on one shared system; order does not matter.

## V1

- **Document engine** — line classification (prose vs math), parsing, a global
  constraint graph, solving by symbolic rearrangement with a numeric fallback,
  claim cross-checking, and inline annotations.
- **Live editor** — CodeMirror 6 with math syntax highlighting, inline results,
  quiet inline errors, conflict decorations with click-to-fix, narrow-screen
  result placement.
- **Notebooks** — multiple documents in IndexedDB (Dexie), autosave, editable
  titles, last-modified ordering, `.inlign` text export/import, JSON
  backup/restore.
- **Shell & settings** — top bar + full-bleed editor, notebook switcher,
  settings and help sheets, themes/accent, precision, tolerance override, angle
  mode, data controls.
- **In-app documentation** — Getting started, Syntax reference, How checking
  works, Engine limits, Data & backup.
- **Distribution** — installable offline PWA, GitHub Pages deploy, Tauri v2
  wrappers for Windows, macOS, Linux and Android (iOS is PWA-only), release
  workflow driven by version tags.

Explicit non-goals for v1: graphing, units, matrices/vectors/complex numbers,
scripting, LaTeX rendering, natural-language math, domain logic (physics,
chemistry, finance), accounts/sync/telemetry. Every one is a deliberate
candidate for later; the architecture must make them additions, not rewrites.

## UX Principles

- **User text is sacred.** Inlign never silently edits the document. Conflicts
  are flagged inline with the expected value and a one-click fix.
- **Quiet when unsure.** Parse errors, unresolved symbols and non-converging
  solves produce a muted marker, never a wrong number.
- **Drafting stays fluid.** Results appear inline at the line end; on narrow
  screens they drop to an indented line of their own.
- **Answers are complete.** Equations with unknowns solve regardless of line
  order; multiple real solutions are shown up to four, plus a count.
- **Precision is respected.** Claim checking honours the written precision of
  the claim (its last written decimal place), with a global tolerance override
  in settings.
- **Plain text is the document.** The same text exports as `.inlign` and remains
  readable in any editor.

## Core Data

- A **notebook** is a title plus its text; text is the source of truth, and every
  derived annotation is recomputed from it.
- Notebooks persist in IndexedDB (Dexie) with autosave and last-modified
  ordering; backups are a JSON file; exports are `.inlign` plain text.
- Settings (theme, accent, angle mode, precision, tolerance, smart-number
  display) persist per device and travel in backups.

## Engine & Logic

- The whole document is **one constraint system**; line order does not matter.
- `identifier = expr` is a definition/claim; any other `lhs = rhs` is an
  equation to solve. Duplicate definitions with different values are errors.
- Solving combines symbolic rearrangement (Nerdamer, pinned exact, behind an
  adapter) with numeric solving; unsupported cases degrade quietly.
- `%` is a percent literal and `mod(a, b)` is modulo; angles default to radians
  with a degrees setting.
- The engine is a pure layer with no UI, storage or i18n imports, and it never
  throws across its boundary. It runs in a Web Worker so typing stays smooth to
  ~500 lines.

## Technical Direction

- React + TypeScript + Vite, Tailwind v4 semantic tokens, CodeMirror 6.
- Local-first: no accounts, no sync, no telemetry, zero network calls after
  load. Everything runs on the device.
- Installable PWA (fully offline) plus Tauri v2 wrappers: Windows NSIS, macOS,
  Linux AppImage/deb, Android APK. macOS/Linux artifacts are unsigned in v1.
- English-only v1 with an i18n seam; the house style ships Light/Dark/OLED
  themes with six accents, blue by default.
- Quality gates: typecheck, lint, engine/data/component unit tests, Playwright
  end-to-end flows, screenshots; tag pushes deploy the PWA and publish native
  artifacts from CI.
- MIT licensed, developed in the open at `github.com/benyamin-git/Inlign`.
