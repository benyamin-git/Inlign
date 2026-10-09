# Inlign — Agent Notes

Local-first live mathematical notepad: plain text that computes and checks itself
as you type. PWA plus Tauri v2 desktop and Android wrappers. See `masterplan.md`
for product direction.

## Commands

Node 22.12+ is required (installed via nvm on this machine). Prefix commands in
non-interactive shells:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
```

| Command                            | Purpose                                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                      | Vite dev server                                                                                                                                                       |
| `npm run dev:lan`                  | Vite dev server on `0.0.0.0:7406` (strict) for LAN/phone testing                                                                                                      |
| `./scripts/live.sh`                | Background live server on `0.0.0.0:7406` (strict); `LIVE_SERVER_PORT` overrides, log `/tmp/inlign-liveserver.log`, stop with `kill $(cat /tmp/inlign-liveserver.pid)` |
| `npm run build`                    | Typecheck + production build + PWA service worker                                                                                                                     |
| `npm run preview`                  | Serve the production build                                                                                                                                            |
| `npm run typecheck`                | `tsc -b` across app and node configs                                                                                                                                  |
| `npm run lint`                     | ESLint (flat config)                                                                                                                                                  |
| `npm test`                         | Vitest run (jsdom, fake-indexeddb)                                                                                                                                    |
| `npm run test:e2e`                 | Playwright end-to-end suite                                                                                                                                           |
| `npm run format`                   | Prettier write                                                                                                                                                        |
| `npm run icons`                    | Regenerate PWA icons into `public/icons/`                                                                                                                             |
| `npm run icons:native`             | Regenerate Tauri/Android icons from `public/icons/icon-512.png`                                                                                                       |
| `npm run accents`                  | Regenerate accent palettes into `src/theme/accents.css`                                                                                                               |
| `npm run screenshots`              | Capture desktop screenshots into `screenshots/`                                                                                                                       |
| `npm run tauri`                    | Tauri CLI                                                                                                                                                             |
| `npm run tauri:build`              | Desktop bundles (needs Rust and platform toolchains)                                                                                                                  |
| `npm run android:init`             | Generate the Android project (first run only)                                                                                                                         |
| `npm run android:apk`              | Android release APK (needs JDK 17, Android SDK/NDK and Rust)                                                                                                          |
| `npm run version:set -- <version>` | Bump the version in `package.json`, `package-lock.json` and `src-tauri/Cargo.toml`                                                                                    |

Always run `npm run typecheck`, `npm run lint` and `npm test` before finishing work.

## Hard rules

- **Never modify `src/engine/**` without explicit permission from the project
  owner.** The engine is the product's core: pure functions, no React, DOM, Dexie,
  i18n or UI imports (enforced by an ESLint restriction). Invalid input produces
  quiet unresolved results; the engine never throws across its boundary.
- Every engine module has a colocated `*.test.ts` covering known values and edge
  cases.
- User-facing text lives in `src/i18n/en.ts`; components never hard-code strings.
  The i18n seam keeps later locales an addition, not a rewrite. `src/engine/**`
  must never import `src/i18n`.
- Documentation bodies live in `src/docs/en/`; registry titles and summaries live
  in `src/docs/registry.ts`, not in the markdown.
- Never hand-edit generated files (`public/icons/`, `src/theme/accents.css`,
  `screenshots/**`, `src-tauri/icons/**`, `src-tauri/gen/**`). Regenerate them
  with `npm run icons` / `npm run accents` / `npm run screenshots` /
  `npm run icons:native` / `npm run android:init`. Accent ids and labels live
  in `src/theme/accents.ts` and must stay in sync with the seed table in
  `scripts/generate-accents.mjs`; a test fails if the generated CSS drifts.
- `screenshots/**` is generated but committed for the README. Never hand-edit the
  PNGs; regenerate them after UI changes that affect the captured screens.
- Releases: the version lives in `package.json`. Use
  `npm run version:set -- <version>`, add a `CHANGELOG.md` entry, then tag
  `v<version>`. Tag pushes deploy the PWA to GitHub Pages (base `/Inlign/`, set
  in the workflow, never in `vite.config.ts`) and publish native artifacts.
- Do not add comments to code unless they explain something non-obvious.
- Do not commit unless the task at hand says to commit.

## Local environment notes

- npm's update-notifier is disabled in `.npmrc`; without it npm stalls for minutes
  on slow or offline links.
- On Android/Termux the dynamic linker refuses to load native N-API addons, so the
  toolchain runs on its WASI fallbacks: `scripts/env.mjs` wraps
  `vite`/`vitest`/`playwright` (setting `NAPI_RS_FORCE_WASI` and
  `NAPI_RS_ASYNC_WORK_POOL_SIZE` on Android only), and
  `scripts/wasm-fallbacks.mjs` (postinstall) unpacks the Oxide and Lightning CSS
  wasm builds and shims `node_modules/lightningcss` onto the wasm package. All of
  it is a no-op on other platforms; do not remove it without testing on Android.
- `npm run icons` rasterizes `public/favicon.svg` with headless chromium (the
  Playwright browser), so a fresh machine needs `npx playwright install chromium`
  before it can regenerate `public/icons/`, same as `npm run test:e2e`.

## Native builds

Native compilation is not part of the local gate ladder; the release workflow
owns it (`.github/workflows/release.yml` builds the desktop matrix and the
Android APK on GitHub runners).

Desktop bundles need Rust stable plus the platform toolchains: Microsoft C++
Build Tools on Windows, Xcode on macOS, and on Linux the WebKitGTK 4.1 dev
packages (`libwebkit2gtk-4.1-dev`, `libxdo-dev`, `libayatana-appindicator3-dev`,
`librsvg2-dev`, `libssl-dev`) with the usual build tools. `npm run tauri:build`
builds the bundles listed in `src-tauri/tauri.conf.json`; `--bundles <list>`
restricts a build to one platform's installers.

Android additionally needs JDK 17, the Android SDK (platform, build-tools,
platform-tools, command-line tools), the NDK (side by side) and the four Rust
targets:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Point `JAVA_HOME` at the JDK, `ANDROID_HOME` at the SDK and `NDK_HOME` at
`$ANDROID_HOME/ndk/<version>` (a literal NDK path; Tauri fails or guesses when
several NDKs are installed and the variable is unset). Then:

- `npm run android:init` — first run only; generates `src-tauri/gen/android`,
  which is not committed (the release workflow regenerates it when missing).
- `npm run android:apk` — release APK, debug-signed until a keystore is
  configured: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`.
- `npm run tauri -- android build --apk --debug` — local debug fallback; debug
  builds get the `com.inlign.app.debug` application id
  (`bundle.android.debugApplicationIdSuffix`), so they install side by side
  with a release build.

## Architecture

| Layer         | Location        | Notes                                                                       |
| ------------- | --------------- | --------------------------------------------------------------------------- |
| App shell     | `src/app/`      | Providers, top bar, sheets, the single-view shell                           |
| Features      | `src/features/` | UI + application logic per area (`editor`, `notebooks`, `settings`, `help`) |
| Engine        | `src/engine/`   | Pure math layer: classifier, constraint graph, CAS adapter, annotations     |
| Data          | `src/data/`     | Dexie schema, zod models, repositories, backup                              |
| Design system | `src/ui/`       | Primitives and layout components                                            |
| Theme         | `src/theme/`    | MD3 CSS-variable tokens, theme switching, generated accent palettes         |
| Localization  | `src/i18n/`     | Typed English dictionary with a locale seam                                 |
| Docs          | `src/docs/`     | Markdown + registry rendered in Help                                        |
| Native shell  | `src-tauri/`    | Tauri v2 config, Rust entry point, generated Android project (CI-side)      |

Rules of dependency: features may import `ui`, `data`, `lib`, `theme`, `engine`.
`engine` imports nothing except its own files and its Nerdamer adapter. `ui`
imports nothing from `features`. `src/i18n` may import `src/lib`; `src/lib` must
never import `src/i18n`. Features, UI, theme and app layers may import `src/i18n`.

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess`.
- Tailwind v4 with MD3 color roles mapped in `src/theme/tokens.css`. Use semantic
  utilities (`bg-surface-container`, `text-on-surface-variant`) — never raw hex.
- Density: 40px controls (`h-control`), 48px touch targets (`h-control-touch`),
  36px rows, 64px top bar. Sizes live as tokens in `src/theme/tokens.css`.
- Base styles belong inside `@layer base` in `src/styles/global.css`. Never add
  unlayered CSS rules: they beat every Tailwind utility and silently break the UI.
- Direction-aware styling uses logical utilities (`ms-`, `me-`, `ps-`, `pe-`,
  `start-`, `end-`, `text-start`, `text-end`, `border-s`); never physical
  `left`/`right`.
- `__APP_VERSION__` and `__APP_PLATFORM__` are injected by `vite.config.ts`. Read
  them through `src/lib/version.ts` and `src/lib/platform.ts`; never touch
  `process.env` from app code.
- Data changes go through `src/data/repositories/*`.
- Generate ids with `newId()` from `src/lib/id.ts`, never `crypto.randomUUID()`
  directly: `randomUUID` is secure-context only and is absent on the plain-http
  LAN origin used for phone testing.
- The editor is whole-line math only; results render as CodeMirror decorations
  and never by editing the user's text.
- User-facing documentation lives in `src/docs/**` and must explain the _why_
  behind opinionated decisions, not just the how.

## Design

- Palette: skill `design` — six accents, default blue
- Themes: Light / Dark / OLED; first run follows prefers-color-scheme; OLED opt-in
- Type: IBM Plex Sans (UI) + IBM Plex Mono (editor)
- Approved: 2026-10-07
