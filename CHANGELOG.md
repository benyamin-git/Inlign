# Changelog

All notable changes to Inlign are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-08

### Added

- **Document engine** — a pure, engine-first TypeScript layer with no UI,
  storage or i18n imports. It classifies every line as prose or math, parses
  statements through a replaceable CAS adapter (Nerdamer 2.0.0), treats the
  whole notebook as one order-independent constraint system, resolves unknowns
  by symbolic rearrangement with a bounded numeric fallback, and cross-checks
  written values at the precision they were written (`2.02` is accepted for
  `2.0198`), with a relative tolerance override in settings. Multiple real
  solutions display inline; impossible or non-converging cases degrade to quiet
  unresolved markers — never a guessed number — and the engine never throws
  across its boundary.
- **Live editor** — CodeMirror 6 with math syntax highlighting, muted inline
  results at the line end (moved to an indented line on narrow screens), quiet
  error and unresolved markers, and conflict annotations that show the expected
  value and apply the one-click fix through a normal, undoable edit; the
  document text is never changed silently.
- **Notebooks** — multiple documents in IndexedDB (Dexie) with autosave,
  editable titles, last-modified ordering in the switcher, `.inlign` plain
  text export/import, and versioned JSON backup/restore.
- **Settings** — Light/Dark/OLED themes with six accents, precision (8–15
  significant digits), a tolerance override, radians/degrees angle mode, and
  data controls (export notebook, import `.inlign`, export and restore backup).
- **In-app help** — Getting started, Syntax reference, How checking works,
  Engine limits, and Data & backup, rendered from a docs registry.
- **Localization seam** — every user-facing string comes from a typed English
  dictionary so later locales are additions, not a rewrite.
- **PWA** — installable and fully offline after load, with generated icons, an
  auto-updating service worker, and zero network calls beyond the initial load.
- **Native shells** — Tauri v2 wrappers for Windows (NSIS), macOS (dmg) and
  Linux (AppImage/deb), plus an Android build producing a universal APK, with
  native open/save dialogs for export, import and backup.
- Project scaffold: Vite 8 + React 19 + TypeScript, Tailwind v4 with the house
  theme tokens, the Vitest unit ladder, and the Android/Termux wasm fallbacks
  that keep the toolchain usable on a phone.
- Repository house documents: README, AGENTS.md, masterplan, contributing guide
  and this changelog.
- CI: GitHub Actions gates (typecheck, lint, tests, build), a Pages deploy, and
  a tag-driven release workflow that builds the web bundle and native
  artifacts, normalizes their names, and attaches them to a release whose
  notes come from this file.

### Fixed

- One-click conflict fixes now receive pointer events: the CodeMirror
  annotation widget used to swallow them, leaving the fix button unclickable.
- Opening a notebook no longer counts as an edit — the timestamp is left alone
  and the switcher keeps its last-modified order.

### Notes

- macOS and Linux desktop artifacts are unsigned in v1: Gatekeeper and some
  Linux desktops need a manual allow. The PWA remains a first-class install.
- iOS is supported through the PWA (Safari → Add to Home Screen); v1 ships no
  native iOS build.
- Native bundles are built by the release workflow on GitHub runners and
  published when a `v*` tag is pushed; the PWA deploys to GitHub Pages from
  `main` pushes and version tags.
- Local-first by design: notebooks and settings live in the browser's
  IndexedDB, and data leaves the device only through a user-initiated export.
