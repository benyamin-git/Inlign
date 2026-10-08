### Task 6 — CAS adapter over Nerdamer

**Files:** `src/engine/cas/types.ts`, `src/engine/cas/nerdamer.ts`, `src/engine/cas/nerdamer.test.ts`.

**Interfaces**

```ts
// src/engine/cas/types.ts
declare const casNodeBrand: unique symbol
export interface CasNode {
  readonly [casNodeBrand]: true
}
export class CasParseError extends Error {}
export interface CasAdapter {
  parse(input: string): CasNode // throws CasParseError
  freeSymbols(node: CasNode): string[]
  isConstant(node: CasNode): boolean
  evaluate(node: CasNode, scope: Record<string, number>): number | null // null when non-numeric
  solveFor(equation: CasNode, symbol: string): CasNode[] // roots of lhs - rhs
  solveSystem(equations: CasNode[], symbols: string[]): Record<string, number[]> | null
  substitute(node: CasNode, scope: Record<string, string>): CasNode
  toString(node: CasNode): string
}
```

Implementation: thin wrapper around `nerdamer` (`nerdamer/solve` for solving), `CasNode` wraps an `Expression`; degrees mode applies a wrapper to trig arguments before evaluation (documented at the adapter boundary); evaluation failure returns `null`, parse failure throws.

**Verification:** `npm test -- cas` — parse/evaluate (`sqrt`, `%` literal handling, `mod`), `freeSymbols`, `solveFor` (linear, quadratic → two roots, `x^2 = 2` → numeric), `solveSystem` (2×2 linear), `substitute`, degrees vs radians.

**Commit:** `feat(engine): add Nerdamer CAS adapter`
**Depends on:** T5

