### Task 5 — Engine types + line classifier

**Files:** `src/engine/types.ts`, `src/engine/classify.ts`, `src/engine/classify.test.ts`.

**Interfaces**

```ts
// src/engine/types.ts
export type LineKind = 'blank' | 'prose' | 'claim' | 'definition' | 'equation' | 'expression'
export type AngleMode = 'radians' | 'degrees'
export interface SolveSettings {
  angleMode: AngleMode
  precision: number
  toleranceOverride: number | null
}
export interface AnnotationFix {
  from: number
  to: number
  insert: string
}
export interface Annotation {
  line: number
  from: number
  to: number
  kind: 'result' | 'conflict' | 'error' | 'unresolved'
  text: string
  expected?: string
  fix?: AnnotationFix
}
export interface SolveRequest {
  version: number
  text: string
  settings: SolveSettings
}
export interface SolveResponse {
  version: number
  annotations: Annotation[]
}
```

```ts
// src/engine/classify.ts
import type { CasAdapter, CasNode } from './cas/types'
export interface Statement {
  line: number
  from: number
  to: number
  kind: 'claim' | 'definition' | 'equation' | 'expression'
  text: string
  symbol: string | null
  node: CasNode
  rhsText: string | null
  claim: boolean
}
export type Classification = { kind: 'blank' | 'prose' } | Statement
export function classifyLine(
  line: string,
  lineIndex: number,
  offset: number,
  cas: CasAdapter,
): Classification
```

Rules: empty/whitespace → `blank`; leading `#` → `prose`; parse failure without an `=` → `prose`; parse failure with `=` → `prose` (quiet, D12); identifier LHS + constant RHS → `claim`; identifier LHS otherwise → `definition`; non-identifier LHS with `=` → `equation`; bare parseable expression → `expression`.

**Verification:** `npm test -- classify` — golden table covering every rule, offsets, `#` comments, prose that looks like math (`the total is 5`), and claim detection.

**Commit:** `feat(engine): add line classifier and annotation types`
**Depends on:** T1

