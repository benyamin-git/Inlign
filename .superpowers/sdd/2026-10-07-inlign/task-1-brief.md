### Task 1 — Scaffold Vite + React + TypeScript app

**Files:** `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `index.html`, `public/favicon.svg`, `src/main.tsx`, `src/app/AppRoot.tsx`, `src/styles/global.css`, `src/test/setup.ts`, `src/env.d.ts`.

**Steps**
1. `npm init` with name `inlign`, `private: true`, `engines.node >=22.12`, `type: module`, repository/homepage fields, license MIT.
2. Dependencies exactly per **Global constraints** (Nerdamer `2.0.0` exact; rest caret ranges).
3. Scripts: `dev`, `dev:lan` (`vite --host 0.0.0.0 --port ${PORT:-7406} --strictPort`), `build` (`tsc -b && vite build`), `preview`, `typecheck`, `lint`, `format`, `format:check`, `test` (`vitest run`), `test:watch`, plus placeholders `test:e2e`, `icons`, `icons:native`, `accents`, `screenshots`, `tauri`, `tauri:build`, `android:init`, `android:apk`, `version:set`.
4. `vite.config.ts`: `base: process.env.VITE_BASE ?? '/'`; define `__APP_VERSION__` from `package.json`, `__APP_PLATFORM__` from `TAURI_ENV_PLATFORM` (fallback `'web'`); `@` alias to `src`; vitest config (`jsdom`, globals, setup file, `css: false`, include `src/**/*.{test,spec}.{ts,tsx}`).
5. `eslint.config.js`: flat config with typescript-eslint, react-hooks, react-refresh; override for `src/engine/**` adding `no-restricted-imports` banning `react`, `react-dom`, `dexie`, `dexie-react-hooks`, `@/data/*`, `@/i18n/*`, `@/features/*`, `@/ui/*`.
6. `AppRoot.tsx` renders a minimal placeholder using `__APP_VERSION__`; `main.tsx` mounts it and imports Tailwind + global styles.
7. `src/lib/version.ts` and `src/lib/platform.ts` read the injected globals (mirror ClyTrade); `src/lib/cn.ts` class combiner.

**Interfaces**
```ts
// src/lib/version.ts
export const APP_VERSION: string;
// src/lib/platform.ts
export const APP_PLATFORM: string;
export const IS_NATIVE: boolean;
// src/lib/cn.ts
export function cn(...parts: Array<string | false | null | undefined>): string;
```

**Verification:** `npm install` creates the lockfile; `npm run typecheck && npm run lint && npm test && npm run build` all exit 0; `npm run dev` serves on the default port.

**Commit:** `chore: scaffold Vite + React + TypeScript app`
**Depends on:** —

