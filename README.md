# Inlign

Inlign is a local-first live mathematical notepad: a plain-text document where
you draft a solution — prose, values, formulas, equations — and a general-purpose
math engine computes every value it can, in place, as you type. It also
cross-checks the values you wrote against what the rest of the document implies,
quietly flags the ones that do not add up, and offers a one-click fix.

It ships as an installable offline PWA and as Windows, macOS, Linux and Android
wrappers built with Tauri v2. Everything runs on the device: no account, no
server, no telemetry, zero network calls after load.

> **Status:** early development. The engine, editor, notebooks and themes are
> being built toward `v0.1.0`; expect rough edges and breaking changes.

## Why it exists

Calculators make you think in one expression at a time; spreadsheets make you
think in cells. Neither lets you draft the way you think: a page of notes with
values and formulas, revised as you go. Existing notepad calculators evaluate but
do not verify what you wrote; computer algebra systems solve but demand a special
workflow. Inlign combines both — a document that computes and checks itself.

```
The ball is dropped from a height of h = 20.
g = 9.81
Fall time: t = sqrt(2 * h / g)
t = 2.1          ← conflict: expected ≈ 2.019       [replace with computed]
Impact speed: v = g * t
v = 20.6
```

## What is in V1

| Area          | What it does                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Editor**    | CodeMirror 6 with math syntax highlighting, inline results, quiet inline errors and click-to-fix conflict markers |
| **Engine**    | The whole document is one constraint system; symbolic rearrangement plus numeric solving, order-independent       |
| **Notebooks** | Multiple documents in IndexedDB, autosave, `.inlign` text export/import, JSON backup/restore                      |
| **Settings**  | Light/Dark/OLED themes with six accents, angle mode, precision and tolerance, smart-number display, data controls |
| **Help**      | Built-in documentation: getting started, syntax reference, how checking works, engine limits, data & backup       |

## Screenshots

Screenshots land with the first tagged release; `npm run screenshots` captures
them into `screenshots/` once the UI is in place.

## Getting started

Requires Node 22.12 or newer and npm.

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run dev:lan    # dev server on http://0.0.0.0:7406 (strict; PORT overrides)
./scripts/live.sh  # the same server in the background (LIVE_SERVER_PORT overrides)
```

`npm run dev:lan` and `./scripts/live.sh` bind `0.0.0.0:7406` so the app can be
opened from a phone or another device on the same network. `live.sh` writes its
output to `/tmp/inlign-liveserver.log` and its pid to
`/tmp/inlign-liveserver.pid`; stop it with
`kill $(cat /tmp/inlign-liveserver.pid)`.

To test installability and offline mode, run `npm run build && npm run preview`.
The service worker is disabled in the dev server.

Other commands:

| Command                            | Purpose                                                             |
| ---------------------------------- | ------------------------------------------------------------------- |
| `npm run build`                    | Typecheck, production build and PWA service worker                  |
| `npm run preview`                  | Serve the production build                                          |
| `npm test`                         | Vitest run (jsdom, fake-indexeddb)                                  |
| `npm run test:e2e`                 | Playwright end-to-end suite                                         |
| `npm run typecheck`                | `tsc -b` across the app and node configs                            |
| `npm run lint`                     | ESLint (flat config)                                                |
| `npm run format`                   | Prettier write                                                      |
| `npm run icons`                    | Regenerate PWA icons into `public/icons/`                           |
| `npm run icons:native`             | Regenerate Tauri and Android icons from `public/icons/icon-512.png` |
| `npm run accents`                  | Regenerate the accent palettes into `src/theme/accents.css`         |
| `npm run screenshots`              | Capture desktop screenshots into `screenshots/`                     |
| `npm run tauri:build`              | Desktop bundles (needs Rust and platform toolchains)                |
| `npm run android:apk`              | Android release APK (needs JDK 17, Android SDK/NDK and Rust)        |
| `npm run version:set -- <version>` | Bump the version in `package.json` and `src-tauri/tauri.conf.json`  |

## Install

The PWA deploys to GitHub Pages on every `v*` tag and installs from the browser
— on iOS, use Safari's Add to Home Screen. Native installers are published on
the releases page; macOS and Linux artifacts are unsigned in v1, so Gatekeeper
and some Linux desktops need a manual allow.

## Privacy

Inlign makes no network calls after the page loads. There is no account, no
sync, no analytics and no telemetry. Notebooks live in your browser's IndexedDB
and never leave the device unless you export them yourself.

## License

MIT — see `LICENSE`.
