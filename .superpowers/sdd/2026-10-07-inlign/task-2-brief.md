### Task 2 — House documents

**Files:** `README.md`, `AGENTS.md`, `masterplan.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`.

**Steps**

1. `AGENTS.md`: commands table (incl. Node/nvm prefix, `live.sh`, port 7406), hard rules (engine purity and protection, semantic tokens only, strings in `src/i18n`, docs registry rule, generated files never hand-edited: `public/icons/`, `src/theme/accents.css`, `screenshots/**`, `src-tauri/icons/**`), architecture table, conventions (strict TS, density tokens, logical CSS properties, version via `src/lib/version.ts`), and the **Design record** required by the design skill:
   ```markdown
   ## Design

   - Palette: skill `design` — six accents, default blue
   - Themes: Light / Dark / OLED; first run follows prefers-color-scheme; OLED opt-in
   - Type: IBM Plex Sans (UI) + IBM Plex Mono (editor)
   - Approved: 2026-10-07
   ```
2. `masterplan.md`: distilled product direction (What Is It / V1 / UX / Core Data / Engine & Logic / Technical Direction) consistent with the spec.
3. `CHANGELOG.md` (Keep a Changelog, `Unreleased`), `CONTRIBUTING.md` (setup + gates), `LICENSE` (MIT, `benyamin-git`).
4. `README.md`: description, feature bullets, privacy statement (no network), screenshots placeholder, dev commands, install/PWA note, MIT.

**Verification:** all files exist; `npm run format:check` passes; `git status` shows only intended files.

**Commit:** `docs: add repository house documents`
**Depends on:** T1

