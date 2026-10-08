### Task 3 — Theme system

**Files:** `src/theme/tokens.css`, `src/theme/accents.ts`, `src/theme/accents.css` (generated), `src/theme/theme.ts`, `src/theme/theme.test.ts`, `scripts/generate-accents.mjs`, `index.html`.

**Steps**

1. `tokens.css`: semantic MD3-style roles (primary family, secondary, tertiary, surfaces/containers 5-step ladder, outline, on-surface, status: profit/loss/warning) for Light, Dark, OLED per the design skill's house style; density tokens (`control` 40px, `control-touch` 48px, `row` 36px, `topbar` 64px, `subtab` 48px) and spacing/radius aliases.
2. `accents.ts`: the six house accents (blue, teal, green, orange, rose, violet) with hue/chroma seeds and per-theme primary values as data.
3. `generate-accents.mjs`: derives every other role per accent/theme in OKLCH with the documented clip rule; writes `src/theme/accents.css`; a test fails if the generated file drifts.
4. `theme.ts`: `ThemeChoice = 'system'|'light'|'dark'|'oled'`; storage key `inlign.theme` in `localStorage` (pre-paint mirror); `initTheme()` (called first in `main.tsx`), `applyTheme(choice)` sets `data-theme` + `color-scheme`; first run resolves `prefers-color-scheme` for light/dark; OLED never auto-selected.
5. `index.html`: inline pre-paint script that resolves `data-theme` and background before first paint (no flash).
6. Fonts: import Plex Sans (variable) + Plex Mono (400/500/600) in `main.tsx`; expose `--font-sans`, `--font-mono`; base styles inside `@layer base`.

**Interfaces**

```ts
// src/theme/theme.ts
export type ThemeChoice = 'system' | 'light' | 'dark' | 'oled'
export function initTheme(): void
export function applyTheme(choice: ThemeChoice): void
export function getStoredTheme(): ThemeChoice
```

```ts
// src/theme/accents.ts
export type AccentId = 'blue' | 'teal' | 'green' | 'orange' | 'rose' | 'violet'
export const ACCENTS: Record<AccentId, { hue: number; chroma: number }>
export const DEFAULT_ACCENT: AccentId // 'blue'
```

**Verification:** `npm run accents && git diff --exit-code src/theme/accents.css` (idempotent); `npm test` covers theme resolution + accent drift; manual: reload in each theme shows no first-paint flash.

**Commit:** `feat(theme): add house-style themes, accents, and fonts`
**Depends on:** T1

