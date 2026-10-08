### Task 4 — Design-system primitives

**Files:** `src/ui/Button.tsx`, `IconButton.tsx`, `Input.tsx`, `Select.tsx`, `Switch.tsx`, `Sheet.tsx`, `Dialog.tsx`, `Tooltip.tsx`, `TopBar.tsx`, `EmptyState.tsx`, `src/ui/*.test.tsx`.

**Steps**

1. Button variants (filled/tonal/text), 40/48 px heights, focus ring, disabled state not color-only; Input with always-visible label; Select; Switch; Sheet (bottom on narrow, side/floating on wide) and Dialog with scrim + 16 px radius; Tooltip keyboard-accessible; TopBar 64 px; EmptyState.
2. All components reference semantic tokens only (no raw hex; Ban 9) and follow density/radius scales.

**Verification:** `npm test` — primitive tests render and assert keyboard focus, disabled semantics, and accessible labels.

**Commit:** `feat(ui): add design-system primitives`
**Depends on:** T3

---

## Phase 2 — Engine (pure, protected)

> All tasks in this phase keep `src/engine/**` free of React/DOM/Dexie/i18n imports; ESLint enforces it.

