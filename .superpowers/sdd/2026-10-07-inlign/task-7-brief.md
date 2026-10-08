### Task 7 — Constraint system + resolution

**Files:** `src/engine/constraints.ts`, `src/engine/resolve.ts`, `src/engine/resolve.test.ts`.

**Interfaces**

```ts
// src/engine/constraints.ts
export interface ConstraintSystem {
  statements: Statement[]
  bySymbol: Map<string, Statement[]>
  duplicates: Annotation[] // first authoritative (A3); identical RHS deduped silently
}
export function buildSystem(statements: Statement[]): ConstraintSystem
```

```ts
// src/engine/resolve.ts
export interface ResolvedSymbol {
  status: 'resolved' | 'multiple' | 'symbolic' | 'unsolvable'
  value?: number
  values?: number[]
  symbolic?: string
}
export type ResolvedScope = Map<string, ResolvedSymbol>
export function resolveSystem(
  system: ConstraintSystem,
  cas: CasAdapter,
  settings: SolveSettings,
): ResolvedScope
```

Resolution order: substitution propagation → single-unknown per definition/equation (symbolic rearrange, numeric fallback) → coupled system solve (exact linear/polynomial where supported, bounded numeric otherwise) → unresolved symbols stay `symbolic` (never guess). Later duplicate statements are excluded from the resolution scope.

**Verification:** `npm test -- resolve` — golden cases: forward/backward references in any order; the spec's ball-drop example; quadratic multiples; a cyclic well-posed pair; a nonlinear transcendental case; an unsolvable case → `unsolvable`; duplicate exclusion.

**Commit:** `feat(engine): resolve documents as constraint systems`
**Depends on:** T6

