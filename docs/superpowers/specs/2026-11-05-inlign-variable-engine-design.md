# Inlign Variable Engine — Design Spec

**Status:** Approved
**Date:** 2026-11-05

## Objective / why

Add the first real math capability to Inlign: a line-by-line variable engine
that computes values, keeps equations as constraints, and surfaces the result
in the editor as grey Tab-completable suggestions and red inline errors. The
milestone turns the existing highlight-only notepad into a math notebook where
a formula such as `f = m × a` can be combined with `f = 10` and `m = 2` to
suggest `5` on a later `a =` line.

The engine is deliberately narrow. It handles arithmetic equations, linear
systems, simple non-linear equations, and a single set-valued variable. It is
not a computer algebra system. The outcome is a usable groundwork layer that
later milestones can extend without rewriting the parser, the worker protocol,
or the editor integration.

The milestone also settles the product direction: every non-empty line is
math. Prose lines are invalid, and the README/AGENTS claims about a mixed
prose-and-formula notepad are updated accordingly.

## Success criteria / definition of done

1. The exact example works:
   - L1 `f = m × a`
   - L2 `f = 10`
   - L3 `m = 2`
   - L4 `a = ` (caret at end, focused)
   - L4 shows grey `5`; Tab inserts `5`; L4 becomes `a = 5`; the edit
     autosaves and survives reload.
2. Suggestions are prefix-only. If `a = ` appears before the values that
   determine `a`, it shows no suggestion; a later formula or value never
   retroactively fills an earlier line.
3. Incomplete lines are not errors. `a =`, `a = 2 +`, and unclosed
   parentheses leave the line unmarked and evaluation continues.
4. Empty/whitespace-only lines are ignored and never stop evaluation.
5. A conflicting assignment keeps the first value. `a = 5` followed by
   `a = 6` marks the second line red with `a = 5`, leaves `a` at 5, and dims
   every later line. Fixing the conflict resumes evaluation and clears the
   dimming.
6. A false numeric equality (`1 = 2`) turns red with `false` and stops.
7. An invalid line (`hello world`, `a == 2`, a bare expression) turns red with
   `invalid` and stops.
8. Division by zero (`a = 1 / 0`) turns red with `÷ 0` and stops.
9. A quadratic works: `x^2 = 4`, then `x = ` shows `±2`; Tab inserts `±2`;
   the line becomes `x = ±2`. A later `x = 2` narrows the value, and a later
   `x = ` shows `2`.
10. A non-symmetric quadratic works: `x^2 + x = 0`, then `x = ` shows
    `0, -1`; Tab inserts only `0`.
11. A set conflict works: `x^2 = 4`, then `x = 3` turns red with `x = ±2`.
12. Only one set-valued variable exists at a time. `x^2 = 4`, then
    `y = x + 1`, then `y = ` shows no suggestion.
13. A formula after its values does not fill an earlier incomplete line.
14. A 500-line notebook evaluates in the worker in under 50 ms after the
    120 ms debounce.
15. The suggestion and error are exposed to screen readers through
    `aria-describedby`; errors also set `aria-invalid`; the red border is never
    the only signal; Tab acceptance and normal Tab navigation both work.
16. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
    `pnpm test:e2e`, `pnpm build`, `cargo fmt --check --all`,
    `cargo clippy --workspace --all-targets -- -D warnings`,
    `cargo test --workspace`, and the accent drift check all pass, and CI is
    green.
17. README and AGENTS describe the engine, the math-only rule, the solver
    limits, the worker boundary, and the updated PWA/WASM facts. The approved
    foundation spec and plan are unchanged.
18. No network request, account, telemetry, or new third-party runtime service
    is introduced. Suggestions and errors are derived state and are never
    stored, exported, or backed up.

## Scope

### In scope

- A pure Rust parser and evaluator for equations:
  - `expression = expression`, exactly one top-level `=`.
  - `name = expression` as the normal assignment form.
  - ASCII, multi-letter, case-sensitive names (`[A-Za-z_][A-Za-z0-9_]*`).
  - Decimal numbers, unary minus, parentheses, `+ - * /`, `^` with numeric
    exponents, and the typographic aliases `− × ÷ ·`.
  - `±` as a general unary operator.
- Line-by-line prefix evaluation with persistent constraints:
  - Linear systems solved by incremental reduced row-echelon form.
  - Quadratic equations, pure powers, and simple rational equations.
  - Multiple real roots for one variable, using the `±` shorthand for
    symmetric pairs and a comma-separated display for non-symmetric sets.
  - One set-valued variable at a time, with narrowing on later assignments.
  - First-error stop, skipped/dimmed later lines, and first-value retention.
- Editor integration:
  - Focused-card, end-of-caret, empty-RHS suggestions.
  - Tab acceptance with native undo preservation and a fallback.
  - Red card border, red inline error text, and muted later lines.
  - Accessible descriptions and `aria-invalid`.
- Worker protocol and client:
  - Stateless `evaluate` request carrying the whole notebook.
  - Per-line statuses: `ok`, `empty`, `incomplete`, `error`, `skipped`.
  - `serde` + `serde-wasm-bindgen` in the WASM facade.
- Tests, docs, and CI coverage for the above.

### Non-goals (explicitly out)

- Prose lines, mixed prose/formula cards, comments, or a text mode. Every
  non-empty line is math.
- Bare expressions (`2 + 2`), comparison operators (`<`, `>`, `≤`, `≥`, `≠`,
  `≈`), `%`, brackets, commas as input, units, functions, constants, implicit
  multiplication (`2a`), or matrices.
- General symbolic algebra, symbolic output, or derived-form display such as
  `m = f/a`.
- Coupled non-linear systems, systems with more than one set-valued variable,
  cubic/quartic general solving, numerical root finding, complex numbers, or
  equations with an unknown exponent (`x^y`).
- More than one set-valued variable, or propagating a set into a second
  variable.
- Settings for precision, tolerance, angle units, or solver behavior.
- Structural undo; only the textarea's native undo exists.
- Changes to the data model, IndexedDB schema, `.inlign` format, JSON backup
  format, themes, accents, ports, or deployment.
- A release/version bump; the workspace stays at `0.1.0`.

## Decision log

| # | Decision | Rationale | Status | Source |
| --- | --- | --- | --- | --- |
| D1 | One spec and a two-phase plan: engine/protocol, then editor UI | Keeps the pure engine independently verifiable | decided | user |
| D2 | Math-only notebook; every non-empty line is math | User directive; prose becomes invalid | decided | user |
| D3 | Exactly one top-level `=`; `expression = expression`; bare expressions invalid | One statement per card, false equalities detectable | decided | user |
| D4 | ASCII multi-letter case-sensitive names; decimals; `+ - * /`, `− × ÷ ·`; parentheses; unary minus; `^` numeric exponents; no implicit multiplication/functions/units/comparisons | Small, testable grammar; `·` matches the existing highlighter | decided | user |
| D5 | Incomplete lines are in-progress, never errors, and do not stop evaluation | Typing must not flash red | decided | user |
| D6 | Empty lines are ignored and evaluation continues | Empty cards are a normal editor state | decided | user |
| D7 | Numeric output only; no symbolic derived forms | Keeps the completion surface simple | decided | user |
| D8 | Linear elimination, plus quadratics, pure powers, and simple rationals; coupled non-linear systems unsolved | User chose linear elimination, then simple non-linear support | decided | user |
| D9 | Symmetric roots use `±v`; non-symmetric sets display `largest, ...`; Tab takes the largest | Compact shorthand for the common case, deterministic fallback | decided | user |
| D10 | `±` is a general unary operator accepted anywhere an expression is allowed | User choice; solver still bounds what it can branch | decided | user |
| D11 | One set-valued variable only; sets do not propagate into a second variable | Prevents combinatorial growth | decided | user |
| D12 | Sets narrow on assignment; a conflicting assignment shows the set | Preserves all roots until the user chooses | decided | user |
| D13 | An equation with no real solution is red `false` and stops | Matches the impossible-statement rule | decided | user |
| D14 | Suggestions are prefix-only; later lines never retroactively fill earlier ones | Matches the line-by-line model | decided | user |
| D15 | Persistent relations and multiple constraints per variable | Allows `f = m × a` and `f = m + a` to coexist | decided | user |
| D16 | Keep the first value; a conflicting line never overrides it | The conflict is the new line's problem | decided | user |
| D17 | First error stops everything; later lines are not parsed, evaluated, or annotated; they dim | User directive; one clear error at a time | decided | user |
| D18 | Mark the conflicting line only, not earlier participating lines | The line that introduces the contradiction carries it | decided | user |
| D19 | Shortest round-trip formatting, trimmed zeros, 12 significant digits; relative `1e-9` equality | Readable values without float surprises | decided | user |
| D20 | Suggestions only on the focused card, caret at end, empty RHS | Prevents noise while typing | decided | user |
| D21 | Tab inserts only the missing suffix, with a leading space when needed; native undo preserved; Escape dismisses | Least surprising completion | decided | user |
| D22 | Red card border and red inline text after the user input; user text keeps normal color | Clear, non-destructive error display | decided | user |
| D23 | Short error copy: `a = 5`, `false`, `÷ 0`, `invalid` | Terse and unambiguous | decided | user |
| D24 | Later lines use `text-on-surface-variant` and a muted grip, no opacity | Dimming without breaking the contrast floor | decided | user |
| D25 | Full screen-reader hints via `aria-describedby`; errors set `aria-invalid`; no color-only meaning | Accessibility floor | decided | user |
| D26 | Set conflicts use the same display notation as suggestions | One notation for one concept | assumed | recommendation |
| D27 | Annotations render in the existing highlight layer; measure textarea and highlight layer for auto-grow | Reuses the transparent-textarea overlay; avoids clipping | assumed | recommendation |
| D28 | Tab uses `document.execCommand("insertText")` with a fallback to the change action | Only browser path that preserves native undo | assumed | recommendation |
| D29 | Error attribution: a single conflicting variable shows `var = value`; otherwise `false` | Actionable errors for the common case | assumed | recommendation |
| D30 | Stateless worker; whole notebook after a 120 ms debounce; per-line statuses | Simple, reorder-safe, no worker state bugs | decided | user |
| D31 | `serde` + `serde-wasm-bindgen` in the WASM facade; core stays pure | Typed protocol without manual JS glue | decided | user |
| D32 | 500 lines evaluated in under 50 ms in the worker | Keeps suggestions responsive | decided | user |
| D33 | Engine failure disables annotations silently; the notepad stays usable | Local-first resilience | assumed | recommendation |
| D34 | Protocol: `{ id, lines: { id, text }[] }` request; per-line `{ id, status, suggestion?, error? }` response | Minimal stateless contract | assumed | recommendation |
| D35 | `EngineClient` becomes a typed generic client exposing `evaluate(lines)` | One pending-map implementation for all requests | assumed | recommendation |
| D36 | `useEngineEvaluation` in `features/editor/` owns the debounce and stale-response guard | Keeps the worker concern out of display components | assumed | recommendation |
| D37 | Incremental RREF rather than re-solving every prefix | Meets the 500-line performance target | assumed | recommendation |
| D38 | Univariate solving order: linear → quadratic → pure power → rational with linear denominator; otherwise silent | Clear, testable solver boundary | assumed | recommendation |
| D39 | `±` parses anywhere, but only branches a singleton/constant operand; `±` involving a set stays unsolved | Honors the general operator without a disjunctive solver | assumed | recommendation |
| D40 | Workspace version stays `0.1.0` | No release or versioning work in this milestone | assumed | recommendation |
| D41 | Spec and plan paths use the 2026-11-05 date | Established convention | assumed | recommendation |
| D42 | Rust modules `lexer`, `parser`, `ast`, `solver`, `format`, `evaluate` | One responsibility per module | assumed | recommendation |
| D43 | Full test gate: Rust, TS, Playwright, and every existing CI command | No regression in quality | decided | user |
| D44 | Update README/AGENTS; never edit the approved foundation spec/plan | Documentation must match reality | assumed | recommendation |
| D45 | No new settings; precision and tolerance are code constants | Smallest surface; settings can come later | assumed | recommendation |
| D46 | No new theme tokens; use existing semantic roles | The design system already covers status and muted text | assumed | recommendation |
| D47 | Repo commit style; spec and plan committed separately after approval | Matches history and the planning gates | assumed | recommendation |

## Architecture

### Runtime shape

```text
React App
  -> EngineClient (one per app, owns the worker)
       -> Web Worker (stateless request/response)
            -> @inlign/engine-wasm (serde facade)
                 -> inlign-engine (pure Rust: parse -> constrain -> solve -> format)
  -> useEngineEvaluation(lines) (120 ms debounce, stale-response guard)
  -> NotebookEditor -> LineCardList -> LineCard (ghost/error/dim rendering)
```

The UI never imports `@inlign/engine-wasm` directly. The worker remains the
only WASM boundary. The core has no WASM, DOM, React, storage, or worker
dependency.

### Statement model

Each non-empty line is parsed as an equation:

```text
line      := expression "=" expression
expression := term (("+" | "-") term)*
term      := unary (("*" | "/") unary)*
unary     := ("-" | "±") unary | power
power     := primary ("^" number)?
primary   := number | name | "(" expression ")"
name      := [A-Za-z_][A-Za-z0-9_]*
number    := digits with an optional decimal point
```

- `^` is right-associative in the parser but its exponent must evaluate to a
  known number for solving; `x^y` with unknown `y` is a valid but unsolved
  constraint.
- `±` is parsed anywhere an expression is allowed. The solver only branches it
  when the operand evaluates to a single value; `±` involving a set-valued
  variable stays unsolved.
- There is exactly one top-level `=`. Missing, extra, or misplaced `=` tokens
  make the line invalid.
- Empty/whitespace-only lines are a separate `empty` status and never reach the
  parser as equations.
- Incomplete syntax (EOF after an operator, after `=`, or inside an
  unclosed parenthesis) is a separate `incomplete` status and never an error.

### Evaluation state

The evaluator walks lines in order and maintains:

- `constraints`: every accepted equation, with a flag for whether it has been
  fully applied. A variable may have several constraints (D15).
- `values`: per variable, one of:
  - unknown,
  - a single `f64`,
  - a set of `f64` values (at most one variable may be a set at a time).
- `linear`: an incremental reduced row-echelon form over variables that have
  singleton or unknown values. It solves linear equations and detects
  inconsistency.
- `pending`: non-linear constraints that are not yet solvable, kept for a
  later pass.

After every accepted line, the evaluator re-checks pending non-linear
constraints. A new value can make an earlier constraint solvable; that value
becomes available to later lines, never to earlier ones. The pass repeats until
no value changes (a monotone fixpoint, bounded by a safety iteration cap).

### Per-line algorithm

1. Trim the line. If empty, emit `empty` and continue.
2. Parse. If incomplete, emit `incomplete`; if the line is exactly `name =`
   with an empty RHS and `name` has a known value, attach a suggestion.
   Continue without adding a constraint.
3. If invalid, emit `error("invalid")`, stop, and mark every later line
   `skipped`.
4. For a complete equation:
   - Substitute singleton values and simplify. Division by zero emits
     `error("÷ 0")` and stops.
   - If the equation becomes a numeric equality, compare with tolerance:
     true → `ok`; false → `error("false")` and stop.
   - If it is an assignment to a variable with a known conflicting value,
     emit `error("<var> = <value>")` and stop.
   - Add the equation as a constraint. If it is linear, add it to the RREF.
     If the RREF becomes inconsistent, emit a conflict error and stop.
   - If it is non-linear and univariate after substitution, try the solver
     order in D38. Multiple roots create a set for that variable if no other
     variable is set-valued. No real roots emit `error("false")` and stop.
   - If it is non-linear with more than one unknown, keep it pending.
   - Re-check pending constraints to the fixpoint. A contradiction found by a
     cascade is attributed to the current line (the line that made it
     decidable).
5. If the line is an empty-RHS assignment (`name =`) and `name` has a known
   value, attach `suggestion`. A set uses `±v` for a symmetric pair, otherwise
   `largest, ...`; the suggestion also carries the exact insertion text
   (`±v`, the largest value, or the single value).
6. Continue until the first error. Every remaining line is `skipped`.

### Linear solving

The RREF is maintained incrementally:

- Each accepted linear equation becomes a row of coefficients plus a constant.
- New rows are eliminated against current pivots, normalized, and used to
  clear their pivot from other rows.
- An all-zero coefficient row with a non-zero constant is inconsistent.
- An all-zero row with a zero constant is dependent and changes nothing.
- A pivot variable is uniquely determined only when its row has no free
  (non-pivot) variable coefficients. Its value is then the row constant.
- A variable that is not a pivot, or whose row has free variables, has no
  numeric value and cannot produce a suggestion.

This handles single assignments, substitutions, 2×2 systems, underdetermined
systems, duplicate equations, and contradictions without re-solving every
prefix.

### Non-linear solving

After singleton substitution, a non-linear equation with exactly one variable
is attempted in this order:

1. **Linear:** `a x + b = 0` → `x = -b/a`.
2. **Quadratic:** `a x² + b x + c = 0` → real roots from the discriminant.
   A double root is one value; a positive discriminant gives two values.
3. **Pure power:** `a xⁿ + b = 0` for a positive integer `n` → the real nth
   root. Even `n` with a negative constant has no real roots; odd `n` has one.
4. **Simple rational:** clear a single linear denominator, solve the resulting
   linear/quadratic equation, and reject solutions that make the denominator
   zero. An identity after clearing is true for every value in the domain and
   produces no value.

Anything else stays pending and silent. `x^y` with an unknown exponent is
valid but unsolved. Coupled non-linear equations are unsolved.

### Sets and multiple roots

- A real quadratic or even pure power may produce two roots.
- Symmetric pairs display and insert as `±v`.
- Non-symmetric pairs display as `largest, next...` and insert only the
  largest value.
- At most one variable may be a set. A propagation that would create a second
  set leaves that constraint pending and produces no value (D11).
- A later assignment intersects the set:
  - one matching value → the set narrows to that single value,
  - a value outside the set → conflict, showing the set,
  - `±v` → keeps the set when both values match.
- A set is never stored; it exists only in the derived engine response.

### Error attribution

- Conflict on a single variable: `<var> = <formatted value>` (or the set
  notation for a set).
- Numeric false equality or a cascade with no single variable: `false`.
- Division by zero: `÷ 0`.
- Invalid syntax: `invalid`.
- No real solution: `false`.
- Non-finite arithmetic other than division by zero: `invalid` (assumed).
- Unsupported but valid equations: no annotation and no stop.

### Number formatting and equality

- `f64` values.
- Shortest round-trip text, trailing zeros trimmed, capped at 12 significant
  digits.
- Negative zero formats as `0`.
- Equality uses `|a - b| <= 1e-9 * max(1, |a|, |b|)`.
- Sets are sorted descending before display.
- Errors use the same formatter, so `a = 5` and `a = ±2` match the suggestion
  notation.

### Worker protocol

```ts
type LineInput = { id: string; text: string };

type Suggestion = { display: string; insert: string };

type LineStatus = "ok" | "empty" | "incomplete" | "error" | "skipped";

type LineEvaluation = {
  id: string;
  status: LineStatus;
  suggestion?: Suggestion;
  error?: string;
};

type EngineRequest =
  | { id: number; type: "version" }
  | { id: number; type: "evaluate"; lines: LineInput[] };

type EngineResponse =
  | { id: number; type: "version"; version: string }
  | { id: number; type: "evaluate"; lines: LineEvaluation[] }
  | { id: number; error: string };
```

- `EngineClient` keeps one pending map keyed by request id and exposes
  `version()` and `evaluate(lines)`.
- The worker imports the generated package lazily, as today, and returns
  `{ id, error }` for any thrown failure. It never throws across the boundary.
- The request is stateless; the worker holds no per-notebook state.
- The UI debounces 120 ms after line changes, sends the whole active notebook,
  and ignores a response whose request is no longer the latest.
- A worker/WASM failure disables annotations silently; the editor still works.

### Rust facade

- `crates/engine-wasm` adds `serde` and `serde-wasm-bindgen`.
- The facade exports `evaluate(lines: JsValue) -> Result<JsValue, JsValue>` and
  keeps `version()`.
- The facade owns serde DTOs; `inlign-engine` exposes plain Rust types and
  stays free of `wasm-bindgen`, DOM, and storage dependencies.
- User input never panics the core; parse and solve failures are statuses.

### Editor integration

- One `EngineClient` lives at the app level and is passed to the editor; it is
  disposed when the app unmounts.
- `useEngineEvaluation(lines)` returns a `Map<lineId, LineEvaluation>`.
  - Debounce 120 ms.
  - Cancel the timer on unmount/notebook switch.
  - Ignore stale responses.
  - On error, return an empty map.
- `LineCard` receives the annotation for its line and:
  - renders the display text in the existing highlight layer after the user
    text, with a leading space when the line does not end with whitespace;
  - shows the suggestion only when the card is focused and the caret is at
    the end. `onSelect`, `onFocus`, `onBlur`, and `onKeyUp` keep that boolean
    current;
  - handles Tab in `useLineKeys` only when a suggestion is visible; otherwise
    Tab keeps its normal focus behavior;
  - accepts by inserting the `insert` text. `document.execCommand("insertText")`
    is tried first to preserve native undo; if it fails or is unavailable, it
    falls back to the normal `change` action and restores the caret;
  - applies the error border and red text for `status === "error"`;
  - applies the muted text and grip for `status === "skipped"`;
  - adds `aria-invalid` and `aria-describedby` with a visually hidden message
    for errors and suggestions. The highlight layer stays `aria-hidden`.
- The annotation is not part of the textarea value, not autosaved, not
  exported, and not backed up.

### Visual design

The project already has the house design system; this milestone adds states,
not new tokens.

- Ghost suggestion: `text-on-surface-variant`, no opacity. It is supplementary
  text but still meets the contrast floor.
- Error: `border-loss` on the card, `focus-within:outline-loss`, and
  `text-loss` for the inline message. The visible text plus `aria-invalid`
  means meaning never depends on color alone.
- Dimmed/on-hold: `text-on-surface-variant` for the line and a muted grip; no
  opacity. The cards remain editable.
- Card shape, radius, spacing, and surfaces stay as they are.
- The inline annotation can wrap. The card measures both the textarea and the
  highlight layer and grows to the larger height; the textarea keeps its own
  overflow hidden.
- The design self-check runs in Light, Dark, and OLED: contrast, focus,
  targets, semantic labels, no color-only meaning, both form factors.

### Testing

- **Rust unit tests:** lexer, parser (precedence, `^`, `±`, incomplete vs
  invalid, multiple `=`), formatter, linear RREF (single, 2×2,
  underdetermined, inconsistent, duplicate, tolerance), non-linear solver
  (quadratic symmetric/non-symmetric/double/no-real, pure powers, rationals
  and domains), sets (create, narrow, intersect, conflict, one-set limit),
  prefix evaluation (formula before/after values, first error, skipped lines,
  first value, multiple constraints, pending re-check), and a generated
  500-line performance check.
- **TypeScript unit tests:** protocol/client (`version`, `evaluate`, pending
  map, dispose, error), debounce/stale-response hook, line-key Tab behavior,
  `LineCard` rendering of ghost/error/dim/aria states.
- **Playwright:** the exact example, formula-after-values, incomplete,
  conflict and recovery, false, invalid, division by zero, quadratic `±`,
  non-symmetric set, narrowing, set conflict, one-set limit, empty lines,
  mobile wrapping, and Tab-vs-normal-Tab.
- **Quality gate:** all existing commands plus the accent drift check; CI runs
  the same.

### Documentation

- README: describe the engine, math-only rule, suggestions/errors, solver
  limits, worker protocol, and the emitted/precached WASM asset; remove the
  "highlighting only" and "UI does not load the engine" limitations.
- AGENTS: replace the highlight-only hard rules with the engine rules; describe
  the Rust/TS boundary, prefix evaluation, first-error stop, set limit, and
  the fact that the UI now instantiates `EngineClient`; keep the highlighter
  presentation-only.
- Do not edit the approved foundation spec or plan.

## Risks and rollback

| Risk | Mitigation / rollback |
| --- | --- |
| The solver grows beyond a reasonable first milestone | Strict grammar and solver order; coupled non-linear systems and multiple sets stay unsolved and silent; tests pin the limits |
| 500-line notebooks miss the 50 ms target | Incremental RREF, no per-prefix re-solve, worker execution, a generated performance test, and a 120 ms debounce |
| A cascade attributes an error to the wrong line | Every derived value is attributed to the line that made it decidable; tests cover formula-first and formula-last conflicts |
| Tab steals focus navigation | Tab is intercepted only when a suggestion is visible; a separate test covers normal Tab |
| `execCommand` is deprecated or unavailable | Fall back to the normal change action and restore the caret; Playwright covers Chromium; document the fallback |
| Annotations clip or overlap when they wrap | Measure the textarea and highlight layer together; mobile Playwright test |
| Ghost/error text is invisible to screen readers | `aria-describedby` from the textarea to a visually hidden message; `aria-invalid` for errors; the highlight layer stays aria-hidden |
| Math-only invalidates prose users | User-approved product change; README/AGENTS updated; invalid lines are clearly marked and recoverable; no data is changed |
| The engine fails in the browser | Silent annotation disable; the editor, autosave, export, and backup keep working |
| Set notation is confused with input syntax | The protocol separates display from insert; `±` is the only set input shorthand; the spec and README document it |
| Existing notebooks surprise users with red lines | No storage migration; annotations are derived and disappear if the engine is disabled; the user can fix or delete lines |

Rollback is additive: remove the engine hook and the `LineCard` annotation
props, and the notepad returns to plain text. No data migration or schema
change is involved.

## Dependencies / ordering

- Phase 1: Rust core (`lexer`, `parser`, `ast`, `format`, `solver`,
  `evaluate`), WASM facade, worker protocol, `EngineClient`, Rust and TS unit
  tests. This phase is usable without the editor.
- Phase 2: `useEngineEvaluation`, `LineCard`/`useLineKeys` changes, dimming,
  accessibility, Playwright tests, README/AGENTS.
- Phase 1 must land before Phase 2.
- New Rust crates: `serde` (derive) and `serde-wasm-bindgen`, only in
  `crates/engine-wasm`. The core stays dependency-free.
- No new web dependencies, no DB migration, no port change, no PWA manifest
  change. The WASM asset is now emitted; the precache glob already includes
  `wasm`.
- The workspace version stays `0.1.0`.

## Open questions

None.
