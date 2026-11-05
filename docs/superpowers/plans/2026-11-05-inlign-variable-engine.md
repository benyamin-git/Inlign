# Inlign Variable Engine — Implementation Plan

**Status:** Approved
**Date:** 2026-11-05
**Spec:** [2026-11-05-inlign-variable-engine-design.md](../specs/2026-11-05-inlign-variable-engine-design.md)

This plan implements the approved spec in two phases: Phase 1 is the pure Rust
engine, WASM facade, worker protocol and client; Phase 2 is the editor
integration, end-to-end tests and documentation. It does not implement code.
Each task is a commit-sized, independently verifiable unit.

## Global constraints (verbatim from the spec)

- **Math-only.** "Math-only notebook; every non-empty line is math" (D2).
  "Prose lines are invalid" (Objective).
- **One equation.** "Exactly one top-level `=`; `expression = expression`;
  bare expressions invalid" (D3).
- **Incomplete is not an error.** "Incomplete lines are in-progress, never
  errors, and do not stop evaluation" (D5).
- **Empty is ignored.** "Empty lines are ignored and evaluation continues"
  (D6).
- **Solver scope.** "Linear elimination, plus quadratics, pure powers, and
  simple rationals; coupled non-linear systems unsolved" (D8).
- **Sets.** "Symmetric roots use `±v`; non-symmetric sets display
  `largest, ...`; Tab takes the largest" (D9). "One set-valued variable only;
  sets do not propagate into a second variable" (D11). "Sets narrow on
  assignment; a conflicting assignment shows the set" (D12).
- **No real solution.** "An equation with no real solution is red `false` and
  stops" (D13).
- **Prefix only.** "Suggestions are prefix-only; later lines never
  retroactively fill earlier ones" (D14).
- **First value wins.** "Keep the first value; a conflicting line never
  overrides it" (D16).
- **First error stops.** "First error stops everything; later lines are not
  parsed, evaluated, or annotated; they dim" (D17). "Mark the conflicting line
  only, not earlier participating lines" (D18).
- **Formatting.** "Shortest round-trip formatting, trimmed zeros, 12
  significant digits; relative `1e-9` equality" (D19).
- **Suggestion trigger.** "Suggestions only on the focused card, caret at end,
  empty RHS" (D20).
- **Tab.** "Tab inserts only the missing suffix, with a leading space when
  needed; native undo preserved; Escape dismisses" (D21).
- **Error copy.** "Short error copy: `a = 5`, `false`, `÷ 0`, `invalid`" (D23).
- **Dimming.** "Later lines use `text-on-surface-variant` and a muted grip, no
  opacity" (D24).
- **Accessibility.** "Full screen-reader hints via `aria-describedby`; errors
  set `aria-invalid`; no color-only meaning" (D25).
- **Worker.** "Stateless worker; whole notebook after a 120 ms debounce;
  per-line statuses" (D30).
- **Facade.** "`serde` + `serde-wasm-bindgen` in the WASM facade; core stays
  pure" (D31).
- **Performance.** "500 lines evaluated in under 50 ms in the worker" (D32).
- **Version.** "Workspace version stays `0.1.0`" (D40).
- **Quality gate.** "Full test gate: Rust, TS, Playwright, and every existing CI
  command" (D43).
- **Docs.** "Update README/AGENTS; never edit the approved foundation
  spec/plan" (D44).
- **No settings.** "No new settings; precision and tolerance are code
  constants" (D45).
- **No new tokens.** "No new theme tokens; use existing semantic roles" (D46).

### Non-goals (verbatim from the spec)

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

### Environment and dependency constraints

- Node `>=22.22.2 <23`; pnpm `12.10.1`; Rust stable with the
  `wasm32-unknown-unknown` target, rustfmt and clippy; edition 2024, MSRV 1.85;
  wasm-pack on `PATH`; Playwright Chromium.
- Dev/preview and Playwright port: `0.0.0.0:7406` / `http://127.0.0.1:7406`.
  Do not change the port or dashboard registration.
- New Rust crates only in `crates/engine-wasm`: `serde` (derive) and
  `serde-wasm-bindgen`. `Cargo.lock` changes; `pnpm-lock.yaml` does not. No new
  web dependencies.
- Do not edit `docs/superpowers/specs/2026-11-01-inlign-foundation-design.md`
  or `docs/superpowers/plans/2026-11-01-inlign-foundation.md`.
- Commit style matches history: `feat(engine):`, `feat(engine-wasm):`,
  `feat(web):`, `test(engine):`, `test(web):`, `docs:`, `chore:`.

## Phase 1 — Engine and protocol

Phase 1 is usable from the client but is not wired to the editor. It must be
green before Phase 2 starts.

### Task P1.1 — Equation AST and lexer

**Files:** `crates/engine/src/ast.rs` (new), `crates/engine/src/lexer.rs`
(new), `crates/engine/src/lib.rs` (module declarations and re-exports).

**Interfaces:**

```rust
// ast.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinOp { Add, Sub, Mul, Div, Pow }

#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Number(f64),
    Var(String),
    Neg(Box<Expr>),
    PlusMinus(Box<Expr>),
    Binary { op: BinOp, left: Box<Expr>, right: Box<Expr> },
}

#[derive(Debug, Clone, PartialEq)]
pub struct Equation { pub left: Expr, pub right: Expr }

// lexer.rs
#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    Number(f64), Name(String),
    Plus, Minus, Star, Slash, Caret, PlusMinus,
    LParen, RParen, Eq, Eof,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Token { pub kind: TokenKind, pub start: usize, pub end: usize }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LexError { InvalidChar, InvalidNumber }

pub fn lex(input: &str) -> Result<Vec<Token>, LexError>;
```

**Rules:**

1. Normalize `−` (U+2212) to minus, `×` (U+00D7) and `·` (U+00B7) to star,
   `÷` (U+00F7) to slash, and `±` (U+00B1) to `PlusMinus` at lex time.
2. Numbers use the approved grammar: one or more digits with an optional
   decimal point (`5`, `5.5`, `5.`). A leading-dot form (`.5`) is outside the
   approved grammar and is `InvalidChar`; this is a clarification of
   "digits with an optional decimal point", not a new decision.
3. Names are `[A-Za-z_][A-Za-z0-9_]*`, case-sensitive.
4. Whitespace is skipped; every token records byte `start`/`end`.
5. Any other character (comma, `%`, bracket, comparison, a second dot, `_`
   inside a number, etc.) is `LexError::InvalidChar`; malformed numbers may be
   `InvalidNumber`. The parser maps every lex error to `invalid`.
6. Empty input returns `[Eof]`; the evaluator handles empty lines before
   lexing.

**Tests** (`#[cfg(test)] mod tests` in `lexer.rs`): every alias maps to the
right kind; precedence-order tokens; multi-letter and case-sensitive names;
`5`, `5.5`, `5.`, `0.001`; `.5` and `1.2.3` are errors; whitespace and byte
offsets; an unknown character is an error; empty input is `[Eof]`.

**Verification:** `cargo test -p inlign-engine lexer::` passes.
`cargo fmt --check --all` and `cargo clippy -p inlign-engine --all-targets -- -D
warnings` pass.

**Commit:** `feat(engine): add equation AST and lexer`

### Task P1.2 — Parser and incomplete classification

**Files:** `crates/engine/src/parser.rs` (new), `crates/engine/src/lib.rs`.

**Interfaces:**

```rust
#[derive(Debug, Clone, PartialEq)]
pub struct IncompleteLine { pub assignment: Option<String> }

#[derive(Debug, Clone, PartialEq)]
pub enum ParseOutcome {
    Equation(Equation),
    Incomplete(IncompleteLine),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParseError { Invalid }

pub fn parse(input: &str) -> Result<ParseOutcome, ParseError>;
```

**Grammar:**

```text
line       := expression "=" expression
expression := term (("+" | "-") term)*
term       := unary (("*" | "/") unary)*
unary      := ("-" | "±") unary | power
power      := primary ("^" unary)?
primary    := number | name | "(" expression ")"
```

`^` is right-associative. The exponent may parse as any unary expression; the
solver later requires a known numeric exponent. This implements the spec's
statement that `x^y` with unknown `y` is "a valid but unsolved constraint"
(Statement model); the grammar's `^ number` line is read as the numeric-exponent
solving case, not a parse restriction.

**Incomplete vs invalid:**

| Input | Outcome |
| --- | --- |
| `a` | `Incomplete { assignment: None }` |
| `a =` / `a =   ` | `Incomplete { assignment: Some("a") }` |
| `a = 2 +` / `a = 2 ^` / `a = (` / `a = (2 + 3` | `Incomplete { assignment: None }` |
| `a = 2` / `a = -2` / `a = ±2` / `a = 2 ^ 3 ^ 2` | `Equation` |
| `a = 2 ± 3` | `Invalid` (`±` is prefix-only, not an infix operator) |
| `2 + 2` / `a + b` | `Invalid` (bare expression) |
| `hello world` / `a = 2 3` / `a = 2 + * 3` | `Invalid` |
| `a == 2` / `a = 2 = 3` / `= 2` / `a = )` | `Invalid` |

Only a single bare `Var` with no `=` is incomplete; every other no-`=` line is
invalid. An incomplete RHS after `=` never carries an assignment suggestion
(only the empty-RHS case does).

**Tests:** precedence (`1 + 2 * 3`), left association of `+`/`-`, right
association of `^`, unary minus vs power (`-2^2` vs `(-2)^2`), `±` in several
positions, every table row, multiple `=`, trailing tokens, unclosed
parentheses, and confirmation that a lex error becomes `Invalid`.

**Verification:** `cargo test -p inlign-engine parser::` passes; fmt and clippy
pass.

**Commit:** `feat(engine): parse equations and classify incomplete lines`

### Task P1.3 — Value formatting, tolerance, and suggestions

**Files:** `crates/engine/src/format.rs` (new), `crates/engine/src/lib.rs`.

**Interfaces:**

```rust
pub const RELATIVE_TOLERANCE: f64 = 1e-9;
pub const SIGNIFICANT_DIGITS: u32 = 12;

pub fn approx_eq(a: f64, b: f64) -> bool;
pub fn format_value(value: f64) -> String;
pub fn format_set(values: &[f64]) -> String;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Suggestion { pub display: String, pub insert: String }

pub fn suggestion_for(values: &[f64]) -> Option<Suggestion>;
```

**Rules:**

1. `approx_eq(a, b)` is `|a - b| <= 1e-9 * max(1, |a|, |b|)` for finite values;
   non-finite values compare only with `==` (NaN is never equal).
2. `format_value` rounds to 12 significant digits, then uses Rust's shortest
   `Display`, trims trailing zeros/dot, and formats negative zero as `"0"`.
   Non-finite values return `"invalid"` defensively; the evaluator never assigns
   them.
3. `format_set` sorts descending, deduplicates with `approx_eq`, returns
   `format_value` for one value, `±v` for a symmetric pair (`a ≈ -b`), and
   `", "`-joined values otherwise.
4. `suggestion_for` returns `None` for an empty slice; a single value uses that
   value for display and insert; a symmetric pair uses `±v` for both; a
   non-symmetric set displays `format_set` but inserts the largest value
   (first after descending sort).
5. Errors and suggestions share this formatter so `a = 5` and `a = ±2` match.

**Tests:** 5, 5.5, -2, 0, -0, `0.1 + 0.2` -> `0.3`, `1/3` ->
`0.333333333333`, trailing-zero trimming, symmetric `[2, -2]` -> `±2`,
non-symmetric `[0, -1]` -> `0, -1`, duplicate roots, single-value sets,
suggestion insert for `[0, -1]` is `0`, and tolerance boundaries (`1e-10`
difference equal, `1e-8` not).

**Verification:** `cargo test -p inlign-engine format::` passes; fmt and clippy
pass.

**Commit:** `feat(engine): format values, sets, and suggestions`

### Task P1.4 — Incremental linear RREF

**Files:** `crates/engine/src/solver.rs` (new), `crates/engine/src/lib.rs`.

**Interfaces:**

```rust
#[derive(Debug, Clone, PartialEq)]
pub struct LinearForm {
    pub coeffs: std::collections::BTreeMap<String, f64>,
    pub constant: f64, // the form is sum(coeffs[v] * v) + constant
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AddOutcome { Consistent, Inconsistent }

#[derive(Debug, Default)]
pub struct LinearSystem { /* private rows, pivots, variable indices */ }

impl LinearSystem {
    pub fn new() -> Self;
    /// Adds `sum(coeffs[v] * v) + constant = 0`.
    /// Mutates only when the row is consistent.
    pub fn add(&mut self, form: LinearForm) -> AddOutcome;
    /// Uniquely determined singleton values only.
    pub fn values(&self) -> std::collections::BTreeMap<String, f64>;
}
```

**Algorithm:**

1. Store rows with a deterministic pivot order (variable index assigned on
   first appearance). The RREF invariant: each pivot column has a 1 in its row
   and 0 in every other row.
2. `add` copies the new row into working coefficients, eliminates every
   existing pivot (subtract `coeff * pivot_row`), and checks the result. If all
   coefficients are approximately zero and the constant is not, return
   `Inconsistent` **before mutating**. If all are zero and the constant is zero,
   return `Consistent` (dependent row).
3. Otherwise choose the smallest-index non-zero coefficient as the pivot,
   normalize the row, insert it, and eliminate that pivot from existing rows.
4. Zero checks use `1e-12 * max(1, row_max_abs)`; comparisons of values use
   `approx_eq`.
5. `values()` returns a variable only when its pivot row has no non-pivot
   coefficients; the value is `-constant` (because the row is
   `sum(coeffs * var) + constant = 0`). Non-pivot/free variables have no value.

**Tests:** `x = 5`; 2x2 `x + y = 3`, `x - y = 1`; underdetermined `x + y = 3`;
duplicate `x + y = 3`, `2x + 2y = 6`; contradiction `x + y = 3`, `2x + 2y = 7`;
duplicate assignment; conflicting assignment; partially determined
(`x = 2`, `y + z = 3`); substitution (`x = 2`, `x + y = 5`); `0 = 0` and
`0 = 1`; tolerance (`x = 0.1 + 0.2`, `x = 0.3`); and deterministic variable
order.

**Verification:** `cargo test -p inlign-engine solver::linear` passes; fmt and
clippy pass.

**Commit:** `feat(engine): add incremental linear solver`

### Task P1.5 — Linearizer and polynomial/pure-power solver

**Files:** `crates/engine/src/solver.rs` (extend), `crates/engine/src/lib.rs`.

**Interfaces:**

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum LinearizeOutcome {
    Linear(LinearForm),
    Numeric(f64),
    Nonlinear,
    DivisionByZero,
    NonFinite,
}

pub fn linearize(
    expr: &Expr,
    values: &std::collections::BTreeMap<String, f64>,
) -> LinearizeOutcome;

#[derive(Debug, Clone, PartialEq)]
pub enum UnivariateOutcome {
    Roots(Vec<f64>),
    NoRealRoots,
    Identity,
    Unsolved,
    DivisionByZero,
    NonFinite,
}

/// Solves `expr = 0` for `var`; `values` holds known singleton values.
pub fn solve_univariate(
    expr: &Expr,
    var: &str,
    values: &std::collections::BTreeMap<String, f64>,
) -> UnivariateOutcome;
```

Internal (not public): `Poly { coeffs: Vec<f64> }` ascending, with
`add/sub/mul/scale/pow/eval/degree/is_zero`, and
`enum PolyOutcome { Poly(Poly), NotPolynomial, DivisionByZero, NonFinite }`.

**Linearization rules:**

1. `Number` -> `Numeric`.
2. `Var` known in `values` -> `Numeric`; unknown -> `Linear(1*v + 0)`.
3. `Neg` negates; `Add`/`Sub` combine `Linear` and `Numeric`; numeric
   operations that produce non-finite values -> `NonFinite`.
4. `Mul` scales only when at most one side contains a variable; two variable
   sides -> `Nonlinear`.
5. `Div` by a non-zero numeric constant scales; zero -> `DivisionByZero`;
   a variable denominator -> `Nonlinear` (the rational solver handles it).
6. `Pow` with numeric base and numeric exponent evaluates `powf`; exponent 1
   is the base; anything else is `Nonlinear`.
7. `PlusMinus` is `Nonlinear` here; P1.9 expands branches before
   linearization.
8. The evaluator linearizes `left - right`; the form's equation is
   `sum(coeffs * var) + constant = 0`.

**Polynomial conversion:**

1. `Number` -> constant; `Var(var)` -> `[0, 1]`; a known other variable ->
   its constant; an unknown other variable -> `NotPolynomial`.
2. `Neg`, `Add`, `Sub`, `Mul` combine polynomials.
3. `Div` by a constant polynomial scales; division by the zero polynomial ->
   `DivisionByZero`; a variable denominator -> `NotPolynomial`.
4. `Pow(base, Number(n))`: numeric base -> `powf`; a polynomial base with a
   non-negative integer exponent -> repeated multiplication; a negative integer
   or non-integer exponent -> `NotPolynomial`. A variable exponent ->
   `NotPolynomial`. Cap the polynomial degree at 64; exceeding the cap at any
   step -> `NotPolynomial` so the worker cannot allocate unbounded arrays.
5. Non-finite intermediate results -> `NonFinite`.

**Solving `expr = 0`:**

1. Try polynomial conversion.
2. Trim near-zero leading coefficients. Zero polynomial -> `Identity`; degree 0
   non-zero -> `NoRealRoots`; degree 1 -> one root; degree 2 -> discriminant
   with `approx_eq` (negative -> `NoRealRoots`, zero -> one double root,
   positive -> two roots).
3. Degree > 2: if only the constant and the degree coefficient are non-zero,
   solve the pure power `a*x^n + b = 0`. Even `n` with a negative `x^n` value
   -> `NoRealRoots`; even `n` with non-negative -> `±` roots (zero deduplicates
   to one); odd `n` -> one real root.
4. Any other degree > 2 -> `Unsolved`. Non-finite roots -> `NonFinite`.

**Tests:** linearization of `m*a` (`Nonlinear`), `2*x + 3` (`Linear`), known
substitution (`Numeric`), division by a constant and by zero, variable
denominator (`Nonlinear`), numeric power, variable power (`Nonlinear`); solver
for linear, symmetric quadratic (`±2`), non-symmetric quadratic (`0, -1`),
double root, no real roots, even/odd pure powers, identity, unsupported cubic,
a degree above the 64 cap -> `Unsolved`, unknown exponent, and non-finite
arithmetic.

**Verification:** `cargo test -p inlign-engine solver::` passes; fmt and clippy
pass.

**Commit:** `feat(engine): solve polynomials and pure powers`

### Task P1.6 — Simple rational solver

**Files:** `crates/engine/src/solver.rs` (extend).

**Interfaces (internal):**

```rust
struct RationalForm { numerator: Poly, denominator: Poly }

enum RationalOutcome {
    Rational(RationalForm),
    NotRational,
    DivisionByZero,
    NonFinite,
}

fn to_rational(
    expr: &Expr,
    var: &str,
    values: &std::collections::BTreeMap<String, f64>,
) -> RationalOutcome;
```

`solve_univariate` keeps its public signature: after polynomial conversion
returns `NotPolynomial`, it tries `to_rational`, then solves the numerator and
checks the denominator.

**Rules:**

1. Build a rational form by combining fractions:
   `Number`, `Var`, `Neg`, `Add`, `Sub`, `Mul`, and `Div` use
   `(n1*d2 ± n2*d1)/(d1*d2)` and `(n1*n2)/(d1*d2)`.
2. `Div` by a zero numerator -> `DivisionByZero`.
3. `Pow` only for numeric exponents: a numeric base evaluates; a non-negative
   integer exponent powers the rational form; a negative integer inverts it;
   anything else -> `NotRational`.
4. Cap the denominator at degree 1 and the numerator at degree 2; a larger
   form -> `NotRational` (outside "simple rationals").
5. The denominator zero polynomial -> `DivisionByZero`; the numerator zero
   polynomial with a non-zero denominator -> `Identity`.
6. Solve the numerator with the polynomial/pure-power solver. Filter out roots
   where the denominator evaluates to approximately zero. If every root is
   rejected -> `NoRealRoots`; no roots -> `NoRealRoots`; unsupported numerator
   -> `Unsolved`.
7. The evaluator only reaches this path for a univariate equation after known
   values are substituted.

**Tests:** `1/x = 2` -> `0.5`; `x/(x+1) = 2` -> `-2`; `x/x = 2` -> no roots
(root 0 rejected); `x/x = 1` -> identity; `1/0 = 2` -> division by zero;
`1/(x-1) = 0` -> no roots; a quadratic numerator with a linear denominator;
an out-of-scope quadratic denominator -> `Unsolved`; a domain-rejected root
leaves the valid root.

**Verification:** `cargo test -p inlign-engine solver::rational` passes; fmt
and clippy pass.

**Commit:** `feat(engine): solve simple rational equations`

### Task P1.7 — Line-by-line evaluator (singletons)

**Files:** `crates/engine/src/evaluate.rs` (new), `crates/engine/src/lib.rs`.

**Interfaces:**

```rust
#[derive(Debug, Clone, PartialEq)]
pub struct InputLine { pub id: String, pub text: String }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineStatus { Ok, Empty, Incomplete, Error, Skipped }

#[derive(Debug, Clone, PartialEq)]
pub struct LineEvaluation {
    pub id: String,
    pub status: LineStatus,
    pub suggestion: Option<Suggestion>,
    pub error: Option<String>,
}

pub fn evaluate(lines: &[InputLine]) -> Vec<LineEvaluation>;
```

Re-export `InputLine`, `LineStatus`, `LineEvaluation`, `Suggestion` and
`evaluate` from `lib.rs`. Internal state:

```rust
struct State {
    values: BTreeMap<String, Value>, // Value::Single(f64) in this task
    linear: LinearSystem,
    constraints: Vec<Constraint>,     // accepted equations + applied flag
    pending: Vec<Equation>,           // unsolved non-linear equations
}
enum Value { Single(f64) }           // P1.8 adds Set(Vec<f64>)
```

Add `fn singles(&self) -> BTreeMap<String, f64>` to extract the current
`Value::Single` entries for the linearizer and direct-assignment RHS
evaluation. After every linear-system change, refresh `values` from
`linear.values()`.

**Per-line algorithm:**

1. Trim. Empty -> `Empty`, continue.
2. Parse. `Incomplete` -> `Incomplete`; attach a suggestion only when
   `assignment` is `Some(name)` and `name` has a known value. Do not add a
   constraint; continue.
3. Invalid -> `Error("invalid")`, stop; every later line is `Skipped`.
4. Complete equation:
   - **Division/non-finite first:** linearize `left - right`; a
     `DivisionByZero` -> `Error("÷ 0")`; `NonFinite` -> `Error("invalid")`.
   - **Direct assignment precedence:** if one side is a bare `Var(name)` and
     `name` has a known value, evaluate the other side. If it is numeric and
     differs -> `Error("<name> = <value>")`; if it matches -> `Ok`; if it
     contains unknowns -> continue to normal linearization. This is the
     precedence needed by success criterion 5 (`a = 5`, then `a = 6` shows
     `a = 5`), and it also gives `f = 10` for a fully known formula-last
     conflict. It resolves the spec's per-line ordering in favour of D29 and
     success criterion 5 (see "Spec clarifications").
   - **Numeric equality:** a `Numeric(v)` result after linearization -> `Ok`
     if `approx_eq(v, 0)`, otherwise `Error("false")`.
   - **Linear:** add the form to `linear` (transactional). If inconsistent,
     use conflict attribution; else refresh `values` from `linear.values()` as
     `Single`.
   - **Non-linear:** collect variables without a known value. If exactly one,
     call `solve_univariate`:
     - one root -> add `var = root` as a linear row (check consistency),
       refresh values;
     - multiple roots -> `Unsolved`/pending in this task (P1.8 adds sets);
     - `NoRealRoots` -> `Error("false")`; `Identity` -> `Ok`;
       `Unsolved` -> pending; `DivisionByZero` -> `÷ 0`; `NonFinite` ->
       `invalid`.
     If zero or more than one unknown, keep it pending (a zero-unknown case
     should already be numeric).
   - Record the accepted equation in `constraints` with `applied` true/false.
   - **Re-check pending to a fixpoint:** repeat up to 64 passes. Try each
     pending equation on the current state; remove it when it becomes applied,
     numeric, or an identity; keep it when still unsolved; an error is
     attributed to the **current** line. Stop when a pass changes no values.
5. A pending equation that becomes contradictory later is attributed to the
   line that made it decidable, not the original line. The original line stays
   `Ok`.

**Conflict attribution:** a direct assignment to a variable with a known value
shows `<var> = <formatted value>`; all other numeric false equalities and RREF
inconsistencies show `false`. With sets, the direct-assignment conflict uses
the set notation (P1.8). The direct-assignment check above is what makes a
conflicting `a = 6` show `a = 5` rather than `false`.

**Tests:** exact example prefix (formula first, then values, then `a =` with a
suggestion); formula after values does not fill an earlier `a =`; empty lines;
incomplete forms; invalid; `false`; `÷ 0`; direct conflict `a = 5` then
`a = 6` -> `a = 5`; first value kept; skipped lines; linear 2x2; pending
formula re-check; multiple constraints per variable; unsupported but valid
line is `Ok` with no annotation; identity; `x^2 = 4` single-solve deferred;
non-finite arithmetic -> `invalid`; a conflict cascade attributes to the
current line.

**Verification:** `cargo test -p inlign-engine evaluate::` passes; fmt and
clippy pass.

**Commit:** `feat(engine): evaluate equations line by line`

### Task P1.8 — Sets, multiple roots, and narrowing

**Files:** `crates/engine/src/evaluate.rs` (extend), `crates/engine/src/lib.rs`.

**Representation:** add `Value::Set(Vec<f64>)`; enforce at most one `Set` in
`values` with a helper `fn set_entry(&self) -> Option<(&str, &[f64])>`. A set
variable may appear in linear rows as a free variable. `refresh_values` (called
after every linear change) reconciles a value the RREF now determines for a
set variable: if the value is in the set, narrow to that `Single` and free the
slot; otherwise return a conflict showing the set. The invariant **after**
refresh is that a set variable is never also a `Single`.

**Rules:**

1. A univariate non-linear equation with multiple real roots:
   - variable unknown, no set slot -> create `Set` with deduplicated,
     descending roots; record no linear row; `Ok`.
   - variable already `Single` -> if the value is among the roots, keep it;
     otherwise conflict `var = value`. A fixed value never becomes a set.
   - variable already `Set` -> keep the equation pending and produce no value:
     a non-linear equation involving a set does not narrow it (see
     clarification 5). Set narrowing is limited to linear single-unknown
     equations and direct assignments, rules 2 and 3.
   - a **different** variable would become a set while a set slot is occupied
     -> keep the equation pending and produce no value (D11).
2. Linear single-unknown equations involving a set variable narrow it: solve
   `a*x + b = 0` for the set variable, then intersect. Intercept that form
   before `LinearSystem::add`; do not add the row while the variable is a set.
   Multi-unknown linear equations involving the set stay pending; they can
   narrow later when the other variables become known. Non-linear equations
   involving a set stay pending/silent (sets do not propagate).
3. An assignment to a set variable is a subset of rule 2: one matching value
   narrows, an outside value conflicts showing `<var> = <set notation>`.
4. A narrowed-to-single set frees the slot, whether narrowed by a direct
   assignment, a single-unknown linear equation, or `refresh_values`; a pending
   equation for another variable may then create the next set on the re-check.
5. Suggestion lookup checks the set first, then `values`; use
   `suggestion_for`. A set displays `±v` or `largest, ...`; insert is `±v`,
   the largest value, or the single value.
6. The one-set limit is per current state, not per notebook.

**Tests:** `x^2 = 4` -> set `±2`; `x = ` -> suggestion display/insert `±2`;
`x = 2` narrows; a later `x = ` -> `2`; `x = 3` -> `x = ±2`; duplicate roots
and `x^2 = 0` -> single `0`; non-symmetric `x^2 + x = 0` -> `0, -1` and insert
`0`; a second set while one is occupied stays pending; `x^2 = 4`, `y = x + 1`,
`y = ` -> no suggestion; narrowing a set via a linear relation
(`x^2 = 4`, then `x + 1 = 3` -> `2`); a linear relation added **before** the
set (`x + y = 3`, `x^2 = 4`, `y = 1`) narrows x to 2, while `y = 4` in the same
prefix conflicts with `x = ±2` at the `y = 4` line; set conflict displays the
set; a set suggestion after narrowing; a non-linear equation involving a set
stays pending.

**Verification:** `cargo test -p inlign-engine evaluate::sets` passes; fmt and
clippy pass.

**Commit:** `feat(engine): support sets and multiple roots`

### Task P1.9 — General `±` branch expansion

**Files:** `crates/engine/src/evaluate.rs` (extend), `crates/engine/src/solver.rs`
(if the expander belongs there), `crates/engine/src/lib.rs`.

**Interfaces (internal):**

```rust
/// Returns up to `limit` equations with each PlusMinus expanded to
/// `operand` and `-operand`; None when there are more than two `±` nodes.
fn expand_plus_minus(equation: &Equation, limit: usize) -> Option<Vec<Equation>>;
```

**Rules:**

1. `±` parses everywhere (P1.2). If the equation has no `PlusMinus`, use the
   normal path.
2. Expand up to two `±` nodes into at most four branches. More than two ->
   treat the line as valid but unsolved: `Ok`, no annotation, no commit.
3. Apply each branch to a clone of the current state using the normal
   equation logic. Drop branches that are invalid, false, division by zero, or
   conflicting.
4. If no branch survives, emit an error. If every branch failed with the same
   hard error (`÷ 0` or `invalid`), emit that error. Otherwise, if the original
   state has a single known value for a direct assignment target, show
   `<var> = <value>`; if the target is a set, show `<var> = <set>`; otherwise
   `false`.
5. If one branch survives, commit it.
6. If several survive, compare each branch's singleton values and set against
   the original state. Let `changed` be the variables whose effective value
   differs.
   - No changed variables -> commit the original state (`Ok`).
   - Exactly one changed variable:
     - collect the distinct branch values (union);
     - if the original state has a `Set` for that variable, intersect it with
       the union; empty -> conflict showing the original set; one -> narrow and
       add the linear row; more -> keep the intersection;
     - if the original state has a `Single`, keep it when it is in the union,
       otherwise conflict;
     - if the original state has no value, create a `Set` from the union when
       it has more than one value; when the union has one value, add the linear
       row and commit a `Single`. A new `Set` is left pending when a different
       set slot is occupied.
   - More than one changed variable -> `Ok`, no commit, no annotation. The
     disjunction is not stored (documented limit; coupled branch systems are
     outside the approved scope).
7. `±` involving a set-valued operand stays pending/silent (D39). `±` is only
   branched when each operand evaluates to a single value.
8. A `±` branch that is a direct assignment uses the direct-assignment
   precedence of P1.7; this keeps `x = ±2` with `x = 2` at `2`.

**Tests:** `x = ±2` -> set; Tab/insertion `±2`; `a + (2 + ±3) = 10` -> set
`{5, 11}` with non-symmetric display/insert; an infix `a = 2 ± 3` is `invalid`
(parser, P1.2); `x = ±0` -> single `0`;
`x = 2`, then `x = ±2` -> keeps `2`; `x = 3`, then `x = ±2` -> `x = 3`;
`x = ±2` with a set already containing both -> keeps the set; `x = ±2` with a
set containing one -> narrows; more than two `±` -> `Ok`/silent;
`±` with a set operand -> pending; branch expansion inside a formula
(`f = ±2 * m`) with a known `m` -> set.

**Verification:** `cargo test -p inlign-engine evaluate::plus_minus` passes;
fmt and clippy pass.

**Commit:** `feat(engine): branch plus-minus equations`

### Task P1.10 — WASM facade with serde

**Files:** `crates/engine-wasm/Cargo.toml`, `crates/engine-wasm/src/lib.rs`,
`Cargo.lock` (generated).

**Dependencies (only in `crates/engine-wasm`):**

```toml
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"
```

**Interfaces:**

```rust
#[derive(serde::Serialize, serde::Deserialize)]
struct LineInputDto { id: String, text: String }

#[derive(serde::Serialize, serde::Deserialize)]
struct SuggestionDto { display: String, insert: String }

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
enum LineStatusDto { Ok, Empty, Incomplete, Error, Skipped }

#[derive(serde::Serialize, serde::Deserialize)]
struct LineEvaluationDto {
    id: String,
    status: LineStatusDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    suggestion: Option<SuggestionDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[wasm_bindgen]
pub fn evaluate(lines: JsValue) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn version() -> String;
```

**Rules:**

1. Deserialize `Vec<LineInputDto>` with `serde_wasm_bindgen::from_value`; map
   core `InputLine`s; call `inlign_engine::evaluate`; map the result to DTOs;
   serialize with `serde_wasm_bindgen::to_value`.
2. Any serde/facade failure returns `Err(JsValue::from_str(...))`; the worker
   converts it to `{ id, error }`. The core never panics on user input.
3. Keep the facade thin: no parsing, solving, formatting, or status decisions.
4. The generated `pkg/` is not committed. The committed package shim stays
   unchanged.

**Tests:** The facade has no native unit test because `JsValue` is a
WASM-boundary type; the core carries all unit tests. `pnpm build:wasm` plus the
Phase 2 e2e exercise the facade. If the implementer adds a native DTO mapping
test, it must not call `JsValue`.

**Verification:** `pnpm build:wasm` succeeds and the generated `.d.ts` exports
`evaluate` and `version`; `cargo fmt --check --all` and
`cargo clippy --workspace --all-targets -- -D warnings` pass.

**Commit:** `feat(engine-wasm): expose evaluate over the WASM facade`

### Task P1.11 — Protocol, client and worker evaluate path

**Files:** `apps/web/src/engine/protocol.ts`,
`apps/web/src/engine/client.ts`, `apps/web/src/engine/worker.ts`,
`apps/web/src/engine/client.test.ts`.

**Protocol (exact shape):**

```ts
export type LineInput = { id: string; text: string };
export type Suggestion = { display: string; insert: string };
export type LineStatus = "ok" | "empty" | "incomplete" | "error" | "skipped";
export type LineEvaluation = {
  id: string;
  status: LineStatus;
  suggestion?: Suggestion;
  error?: string;
};

export type EngineRequest =
  | { id: number; type: "version" }
  | { id: number; type: "evaluate"; lines: LineInput[] };

export type EngineResponse =
  | { id: number; type: "version"; version: string }
  | { id: number; type: "evaluate"; lines: LineEvaluation[] }
  | { id: number; error: string };
```

**Client:** one pending map. Define the request payload and success response
separately so TypeScript distributes over the union:

```ts
type EngineRequestPayload =
  | { type: "version" }
  | { type: "evaluate"; lines: LineInput[] };

type EngineSuccessResponse =
  | { id: number; type: "version"; version: string }
  | { id: number; type: "evaluate"; lines: LineEvaluation[] };

type PendingRequest = {
  resolve: (response: EngineSuccessResponse) => void;
  reject: (reason: Error) => void;
};

#request(request: EngineRequestPayload): Promise<EngineSuccessResponse>;
```

`#request` allocates the id, stores the pending entry, and posts
`{ ...request, id } as EngineRequest`. `#settle` rejects `{ id, error }`
responses and resolves the success union. `version()` and `evaluate(lines)`
call `#request` and narrow on `response.type`. `dispose()` terminates the
worker, rejects all pending requests with
`new Error("EngineClient has been disposed")`, and clears the map. Unknown
response ids are ignored.

**Worker:** keep the synchronous listener and deferred `import(...)`. Add:

```ts
if (request.type === "evaluate") {
  const lines = engine.evaluate(request.lines) as LineEvaluation[];
  return { id: request.id, type: "evaluate", lines };
}
```

The worker never throws across the boundary; its existing rejection handler
returns `{ id, error }`.

**Tests:** extend the `MockWorker` to answer by request type and to leave a
selected request pending for `dispose`. Cover: version resolves; evaluate
resolves with line results; an `{ id, error }` response rejects; dispose
rejects both a pending version and a pending evaluate; a response for an
unknown id is ignored; two evaluate calls resolve independently; the request
id increases.

**Verification:** `pnpm build:wasm && pnpm typecheck`; `pnpm lint`;
`pnpm --filter @inlign/web test -- client.test.ts`; `pnpm format:check`.

**Commit:** `feat(web): add typed evaluate requests to the engine client`

### Task P1.12 — 500-line performance guard

**Files:** `crates/engine/tests/performance.rs` (new), `.github/workflows/ci.yml`
(add one step).

**Test data:** generate 500 lines with a deterministic representative mix:

- 100 independent assignments (`v0 = 0`, ...).
- 100 dependent assignments (`w0 = v0 + 1`, ...).
- 100 two-term relations over the `w` variables.
- 100 checks that reuse known values.
- 100 incomplete empty-RHS assignment lines (`z0 = `, ...).

This exercises parsing, the RREF, known-value substitution, suggestions, and
skipped/empty statuses without constructing a pathological 500x500 dense system.

**Test:**

```rust
#[test]
fn five_hundred_lines_finish_under_fifty_ms_in_release() {
    let lines = generated_lines(500);
    let start = std::time::Instant::now();
    let results = inlign_engine::evaluate(&lines);
    let elapsed = start.elapsed();

    assert_eq!(results.len(), 500);
    // The generated notebook is valid and true end to end; an early error
    // would make the timing meaningless.
    assert!(!results.iter().any(|result| {
        result.status == inlign_engine::LineStatus::Error
    }));
    if !cfg!(debug_assertions) {
        assert!(
            elapsed < std::time::Duration::from_millis(50),
            "500-line evaluation took {elapsed:?}"
        );
    }
}
```

The debug run has no 50 ms assertion (debug builds are slower); the release run
is the budget guard. Print the elapsed time for the CI log.

**CI:** add after `cargo test --workspace`:

```yaml
      - name: Performance guard
        run: cargo test --release -p inlign-engine --test performance
```

**Verification:** `cargo test -p inlign-engine --test performance` (debug) and
`cargo test --release -p inlign-engine --test performance` (prints a time under
50 ms). If the representative dataset fails, profile before changing the
budget; the spec fixes 50 ms.

**Commit:** `test(engine): guard the 500-line performance budget`

### Phase 1 gate

Before Phase 2, run:

```text
pnpm install --frozen-lockfile
pnpm build:wasm
cargo fmt --check --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo test --release -p inlign-engine --test performance
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build
git status --short
```

Expected: every command passes; `git status` shows only intended source/docs
changes and no `packages/engine-wasm/pkg/**` or `apps/web/dist/**`.

## Phase 2 — Editor UI

### Task P2.1 — App-level client and debounced evaluation hook

**Files:** `apps/web/src/features/editor/useEngineEvaluation.ts` (new),
`apps/web/src/features/editor/useEngineEvaluation.test.ts` (new),
`apps/web/src/app/App.tsx`,
`apps/web/src/features/editor/NotebookEditor.tsx`,
`apps/web/src/features/editor/LineCardList.tsx`,
`apps/web/src/features/editor/LineCard.tsx` (prop plumbing only).

**Interfaces:**

```ts
export const ENGINE_DEBOUNCE_MS = 120;

export type EngineEvaluator = {
  evaluate(lines: LineInput[]): Promise<LineEvaluation[]>;
};

export type LineAnnotations = Map<string, LineEvaluation>;

export function useEngineEvaluation(
  engine: EngineEvaluator | null,
  lines: Line[],
): LineAnnotations;
```

`LineCardProps` gains `annotation?: LineEvaluation`.
`LineCardListProps` gains `annotations: LineAnnotations`.
`NotebookEditorProps` gains `engine?: EngineEvaluator | null` (default `null`)
so every existing test still compiles.

**App lifecycle:** create the client in an effect, not during render, so React
StrictMode's mount/unmount simulation cannot leave a disposed client in use:

```ts
const [engine, setEngine] = useState<EngineClient | null>(null);
useEffect(() => {
  const client = new EngineClient();
  setEngine(client);
  return () => {
    client.dispose();
    setEngine((current) => (current === client ? null : current));
  };
}, []);
```

Pass `engine={engine}` to `NotebookEditor`. The editor renders normally while
`engine` is null; annotations appear after the effect. The UI still never
imports `@inlign/engine-wasm`; only the worker does.

**Hook:** on `[engine, lines]`, if `engine` is null set an empty map and
return. Otherwise bump a request-id ref, start a 120 ms `window.setTimeout`,
then call `engine.evaluate(lines.map(({ id, text }) => ({ id, text })))`.
Resolve to a new `Map` keyed by line id; reject to an empty map. Ignore a
response when its request id is no longer current. The cleanup clears the timer
and invalidates the request id. The notebook switch unmounts the editor (keyed
by notebook id), which clears the timer.

**Tests:** `useEngineEvaluation.test.ts` with `renderHook`, fake timers and a
fake `{ evaluate: vi.fn() }`: no call before 120 ms; one call after; results map
by id; a stale first response is ignored after a newer request; rejection
clears annotations; a null engine makes no call; unmount before the timer makes
no call; a lines change restarts the debounce.

**Verification:** `pnpm --filter @inlign/web test -- useEngineEvaluation.test.ts`
passes; `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass.

**Commit:** `feat(web): debounce engine evaluation for the notebook`

### Task P2.2 — LineCard annotations, dimming, auto-grow and ARIA

**Files:** `apps/web/src/features/editor/LineCard.tsx`,
`apps/web/src/features/editor/LineCard.test.tsx` (new).

**Rendering:**

1. Derive from `annotation`:
   - `error = status === "error" ? annotation.error : undefined`
   - `suggestion = status === "incomplete" ? annotation.suggestion : undefined`
   - `dimmed = status === "skipped"`
   - `visibleSuggestion` only when `focused && caretAtEnd`.
2. Render the visible text in the existing `data-line-highlight` layer after the
   token text: a single space when the line is non-empty and does not end in
   whitespace, then a `<span data-line-annotation="error"|"suggestion">`. Error
   uses `text-loss`; the ghost uses `text-on-surface-variant`.
3. Dimmed lines render `line.text` as plain text in the highlight layer with
   `text-on-surface-variant`; do not render token color spans, so the whole line
   is muted without opacity. The textarea remains editable and the grip stays
   muted (`text-on-surface-variant`).
4. Error cards use `border-loss` instead of `border-outline` and
   `focus-within:outline-loss` instead of `focus-within:outline-primary`. The
   visible error text plus `aria-invalid` means red is never the only signal.
5. Track `focused` and `caretAtEnd` (`selectionStart === selectionEnd ===
   value.length`). Update on focus, blur, select and keyUp. Show the ghost only
   when both are true.
6. ARIA: `useId()` for a visually hidden (`sr-only`) message after the
   textarea. Error: `aria-invalid={true}` and `aria-describedby` with
   `Error: <error>.` Suggestion: `aria-describedby` with
   `Suggestion: <display>. Press Tab to accept <insert>.` The highlight layer
   stays `aria-hidden`.
7. Auto-grow: add a ref to the highlight layer; `grow()` sets the textarea
   height to `auto`, reads both `textarea.scrollHeight` and
   `highlight.scrollHeight`, and sets the textarea height to the larger value.
   The layout effect depends on `line.text`, the annotation text and `dimmed`.
   Keep the width ResizeObserver and font-ready re-measure.
8. Add `data-engine-status={annotation?.status ?? "none"}` to the `<li>` for
   tests; the annotation span is inside the aria-hidden layer and is not
   textarea content, not autosaved, not exported.

**Tests:** mock `@dnd-kit/sortable`'s `useSortable` for a direct render. Cover:
error border/text/`data-engine-status`/`aria-invalid`/accessible description;
focused caret-at-end suggestion with the gutter space; no ghost when unfocused
or when the caret is not at the end; suggestion accessible description; dimmed
raw text, no token color spans, `data-engine-status="skipped"`; no annotation
for `ok`/`empty`/`incomplete` without a suggestion; no separator after trailing
whitespace. jsdom has no layout, so wrapping/auto-grow is asserted in the e2e
(P2.4), not here.

**Verification:** `pnpm --filter @inlign/web test -- LineCard.test.tsx` passes;
`pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass.

**Commit:** `feat(web): render engine annotations in line cards`

### Task P2.3 — Tab acceptance and caret restoration

**Files:** `apps/web/src/features/editor/useLineKeys.ts`,
`apps/web/src/features/editor/LineCard.tsx`,
`apps/web/src/features/editor/useLineKeys.test.ts` (new),
`apps/web/src/features/editor/LineCard.test.tsx` (extend).

**Interfaces:**

```ts
export type UseLineKeysOptions = {
  index: number;
  total: number;
  onAction: (action: LineAction) => void;
  suggestion?: Suggestion | undefined;
  onAcceptSuggestion?: ((insert: string) => void) | undefined;
};
```

**Rules:**

1. In `onKeyDown`, after the composing guard and before the existing key
   handling:
   ```ts
   if (event.key === "Tab" && !hasModifier(event) && suggestion && onAcceptSuggestion) {
     event.preventDefault();
     onAcceptSuggestion(suggestion.insert);
     return;
   }
   ```
   Shift/Ctrl/Alt/Meta Tab and Tab without a suggestion keep normal focus
   navigation.
2. `LineCard` passes `suggestion: visibleSuggestion` and an
   `acceptSuggestion` callback. The callback re-checks that the selection is
   collapsed at the end, adds a leading space when the line is non-empty and
   does not end in whitespace, and prefers
   `document.execCommand("insertText", false, text)`.
3. Record `textarea.value` before the command. If it changed, stop: native undo
   and React's input path have handled the edit. If it did not change (or
   `execCommand` is unavailable/throws), fall back to
   `onAction({ type: "change", text: next })`, where `next` inserts at the
   selection, then restore the caret in `requestAnimationFrame`.
4. The insertion text is the protocol `insert` value: a single value, `±v`, or
   the largest value for a non-symmetric set. The display text is never
   inserted.
5. Escape dismisses a visible suggestion (D21): add a `dismissed` state to
   `LineCard`, reset it when `line.text` or the suggestion's `display`/`insert`
   changes, and make `visibleSuggestion` also require `!dismissed`. Wrap the
   hook's key handler in `LineCard`: on Escape with a visible suggestion,
   `preventDefault()`, set `dismissed`, and return; otherwise call the hook.
   Escape never edits the text; with no visible suggestion it keeps native
   textarea behavior. A dismissed suggestion is not accepted by Tab and has no
   `aria-describedby` hint.

**Tests:** `useLineKeys.test.ts` with a hook harness: plain Tab with a
suggestion is prevented and calls the callback with `insert`; Tab without a
suggestion is not prevented; Shift+Tab is not prevented; Enter still splits;
paste behavior unchanged. `LineCard.test.tsx`: focus the textarea, set the
caret at the end, show a suggestion, press Tab; `execCommand` receives the
gutter space; when `execCommand` returns false or leaves the value unchanged,
the change action receives the inserted text; a non-symmetric set inserts the
largest value, not the display string. Escape hides the ghost and its hint;
Tab then is not prevented; changing the line text resets the dismissal and the
ghost returns.

**Verification:** `pnpm --filter @inlign/web test -- useLineKeys.test.ts
LineCard.test.tsx` passes; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`
pass.

**Commit:** `feat(web): accept suggestions with Tab`

### Task P2.4 — Playwright engine flows

**Files:** `apps/web/e2e/engine.spec.ts` (new).

**Helpers:**

```ts
async function newNotebook(page: Page, texts: string[]): Promise<void>;
function line(page: Page, n: number): Locator; // li containing textbox "Line n"
```

`newNotebook` creates a notebook, fills the first line, then presses `End`
before Enter and fills each subsequent line; the last line is focused and its
caret is sent to the end with `End`. Selection helpers use
`[data-engine-status]` and `[data-line-annotation='suggestion'|'error']`.

**Tests (one concern per test; each creates a fresh notebook):**

1. **Exact example + persistence:** `f = m × a`, `f = 10`, `m = 2`, `a = `.
   L4 is focused; the suggestion span is `5`; Tab makes the value `a = 5`; the
   suggestion disappears; after 600 ms and reload the value survives.
2. **Formula after values:** `f = 10`, `m = 2`, `a = `, `f = m × a`. The third
   line has no suggestion (prefix-only). Add a fifth line `a = ` and assert it
   shows `5`.
3. **Incomplete continues:** `a = 2 +`, `b = 3`, `b = ` -> no error on line 1,
   line 2 is `ok`, line 3 suggests `3`.
4. **Conflict and recovery:** `a = 5`, `a = 6`, `b = a + 1`. Line 2 is
   `error` with `a = 5`; line 3 is `skipped`; fix line 2 to `a = 5`; the error
   clears and line 3 becomes `ok`.
5. **False:** `1 = 2` -> error `false`.
6. **Invalid:** `hello world` -> error `invalid`; `a == 2` -> `invalid`.
7. **Division by zero:** `a = 1 / 0` -> error `÷ 0`.
8. **Quadratic `±` and narrowing:** `x^2 = 4`, `x = ` -> `±2`; Tab -> `x = ±2`;
   add `x = 2`; add `x = ` -> `2`.
9. **Non-symmetric set:** `x^2 + x = 0`, `x = ` -> `0, -1`; Tab inserts only
   `0` and the line becomes `x = 0`.
10. **Set conflict:** `x^2 = 4`, `x = 3` -> error `x = ±2`.
11. **One-set limit:** `x^2 = 4`, `y = x + 1`, `y = ` -> no suggestion; `y =`
    remains unmarked (valid but unsolved).
12. **Empty lines:** `f = m × a`, blank, `f = 10`, blank, `m = 2`, blank,
    `a = ` -> suggestion `5`; empty cards never show an error.
13. **Mobile wrapping:** viewport 390x844; `averylongvariablename = 5` then
    `averylongvariablename = 6` then a third line. The error annotation wraps;
    its bounding box is inside the second card and above the third card's top.
14. **Tab vs normal Tab:** a line with no suggestion; focus its textarea; Tab
    moves focus away. A line with a suggestion; Tab accepts and the textarea
    stays focused.
15. **Accessibility:** error textarea has `aria-invalid="true"` and an
    accessible description `Error: a = 5.`; suggestion textarea has an
    accessible description `Suggestion: 5. Press Tab to accept 5.`.

**Verification:** `pnpm build` then
`pnpm --filter @inlign/web exec playwright test e2e/engine.spec.ts` passes in
Chromium; the full `pnpm test:e2e` passes. No `test.only`.

**Commit:** `test(web): cover engine suggestions and errors end to end`

### Task P2.5 — README and AGENTS

**Files:** `README.md`, `AGENTS.md`.

**README checklist:**

1. Intro: the notepad computes and cross-checks values (remove "will").
2. Milestone note: foundation, card notepad and variable engine are complete;
   math evaluation, grey suggestions, inline errors and dimmed on-hold lines
   work.
3. "What works": add the engine path (Rust parse/constrain/solve, worker,
   `EngineClient`, `useEngineEvaluation`, ghost/error/dim states) and state that
   every non-empty line is math.
4. "Why it exists": replace the mixed prose/formula claim with the math-only
   direction.
5. "How it works"/project layout: add `crates/engine/src/{lexer,parser,ast,
   solver,format,evaluate}.rs`, `crates/engine-wasm` facade, `src/engine/`
   protocol/client/worker and `features/editor/useEngineEvaluation.ts`.
6. PWA: the production build emits, precaches and loads the WASM asset through
   the worker; remove "No `.wasm` asset is emitted" and similar claims.
7. Limitations: replace "math is highlighting only" with the solver scope:
   linear/quadratic/pure power/simple rational, one set, no coupled nonlinear
   systems, no second set, no unknown exponents, no functions/units/
   comparisons/brackets/percent/implicit multiplication; number formatting and
   tolerance constants; math-only means prose is invalid.
8. Commands/testing: keep the existing commands; add the release performance
   command and note the 500-line/50 ms budget. Keep the port and secure-context
   claims accurate.
9. Do not edit the foundation spec/plan.

**AGENTS checklist:**

1. Intro: math evaluation is implemented and wired; remove "still to come" and
   "UI does not instantiate either".
2. Architecture: core modules; thin serde facade; one app-level `EngineClient`;
   stateless worker; 120 ms debounce; UI never imports `@inlign/engine-wasm`;
   annotations are derived and never stored.
3. Hard rules: replace "Math is highlighting only" with the engine rules:
   every non-empty line is an equation; exactly one top-level `=`; prefix-only;
   first error stops; first value wins; one set; solver limits; keep the
   highlighter presentation-only. Keep the one-line-per-card, semantic-token,
   no-network, generated-file, PWA-secure-context and docs rules.
4. Design record: add the ghost/error/dim semantic roles and the math-only
   product direction.
5. Commands: add the release performance command. Do not run Prettier over
   docs.

**Verification:** `pnpm format:check` still passes (docs are excluded);
`git diff --check`; review that no claim contradicts the code or the approved
spec. The foundation spec/plan diffs are empty.

**Commit:** `docs: document the variable engine and math-only notebook`

### Task P2.6 — Final quality gate

**Files:** none expected. Any fixes go back into the owning task and its
commit.

**Run from the repository root:**

```text
pnpm install --frozen-lockfile
pnpm build:wasm
cargo fmt --check --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo test --release -p inlign-engine --test performance
pnpm typecheck
pnpm lint
pnpm format:check
pnpm generate:accents
git diff --exit-code -- apps/web/src/theme/accents.css
pnpm test
pnpm --filter @inlign/web exec playwright install chromium
pnpm test:e2e
pnpm build
git status --short
```

Expected: all pass; the performance test prints a release time under 50 ms; the
accent drift diff is empty; `git status` contains only intended source/docs
changes and no `packages/engine-wasm/pkg/**` or `apps/web/dist/**`.

**Manual acceptance:** repeat success criteria 1-15 in the built app at desktop
and 390x844 in Light, Dark and OLED. Confirm the exact example, prefix-only,
incomplete, empty, conflict/recovery, false, invalid, division by zero,
quadratic `±`, non-symmetric set, narrowing, set conflict, one-set limit,
Tab-vs-normal-Tab, screen-reader descriptions and wrapping. Confirm no network
request, account or telemetry is introduced and annotations are absent after
reload until the engine responds.

**Commit:** no separate commit. A failing check is fixed in the task that owns
it, with that task's commit prefix.

## Dependencies and ordering

1. P1.1 -> P1.2 -> P1.3/P1.4 (P1.3 and P1.4 can run in parallel after P1.1/P1.2)
   -> P1.5 -> P1.6 -> P1.7 -> P1.8 -> P1.9 -> P1.10 -> P1.11 -> P1.12.
2. Phase 1 gate must be green before Phase 2.
3. P2.1 -> P2.2 -> P2.3 -> P2.4 -> P2.5 -> P2.6.
4. P1.10 depends on the public engine types from P1.7-P1.9; P1.11 depends on
   P1.10; P2.1 depends on P1.11 and the protocol types.
5. No DB migration, no port change, no manifest/theme/accents change, no
   workspace version bump. `Cargo.lock` is the only lockfile that changes.

## Risks and rollback

| Risk | Mitigation / rollback |
| --- | --- |
| Solver scope grows | Strict grammar, D38 order, silent/pending unsupported equations, tests pin limits |
| 500 lines miss 50 ms | Incremental RREF, no per-prefix re-solve, worker, release guard, 120 ms debounce; profile before changing the budget |
| Cascade attributes an error to the wrong line | Attribute to the line that made a pending equation decidable; test formula-first and formula-last |
| Direct-assignment precedence differs from the spec's per-line order | Explicit clarification below; tests pin success criterion 5 and `false` for non-assignment numeric equality |
| Tab steals navigation | Intercept only plain Tab with a visible suggestion; Shift/modifier Tab and no-suggestion Tab keep native focus; e2e covers both |
| `execCommand` unavailable or returns false | Compare the value before/after; fall back to the change action and restore the caret |
| Annotation clips or overlaps when it wraps | Measure textarea and highlight layer together; mobile Playwright check |
| StrictMode disposes the client | Create the client in an effect and clear state on cleanup; the next effect creates a fresh client; the editor tolerates `null` |
| Ghost/error text invisible to screen readers | `aria-describedby` to an `sr-only` message, `aria-invalid`, highlight layer stays `aria-hidden` |
| Math-only invalidates existing prose | Product change already approved; docs updated; invalid lines are recoverable; no data/schema change |
| Engine/WASM fails | Hook catches the rejection and clears annotations; editor/autosave/export/backup keep working |

Rollback is additive: remove the hook, the `annotation` prop and its rendering;
the notepad returns to plain text with no migration.

## Spec clarifications and implementation notes

These are not new user-facing decisions; they resolve ambiguities or describe
implementation choices. They are presented here for approval with the plan.

1. **Direct-assignment precedence.** The spec's per-line algorithm lists
   numeric equality before assignment conflict, which would make `a = 5` then
   `a = 6` show `false`; success criterion 5 requires `a = 5`. The plan checks a
   direct assignment's RHS against a known value first, then falls back to
   numeric equality. Fully known `f = m × a` therefore shows `f = 10` (D29's
   single-conflicting-variable rule) rather than `false`. Non-assignment
   numeric equalities (`1 = 2`) still show `false`.
2. **Exponent parsing.** `power := primary ("^" unary)?` accepts `x^y` so it is
   "valid but unsolved" as the spec says; the solver requires a known numeric
   exponent. The grammar line `^ number` is read as the solving case.
3. **Leading-dot decimals.** `.5` is outside "digits with an optional decimal
   point" and is invalid; `5.` and `5.5` are valid. The highlighter remains
   presentation-only and may color `.5`; the engine is authoritative.
4. **`±` branch merge.** Up to two `±` nodes (four branches); if more than one
   variable differs across surviving branches, the line is valid and silent.
   This is within D10/D11/D39's bounded behavior; it is not a disjunctive
   solver.
5. **Set narrowing.** Only linear single-unknown equations narrow a set; a
   non-linear equation involving a set stays pending/silent. This keeps D11's
   one-set, no-propagation rule.
6. **StrictMode client lifecycle.** The app-level client is created in an
   effect and disposed in cleanup; the editor accepts a nullable engine. This
   implements "one `EngineClient` lives at the app level" without a disposed
   worker during StrictMode's simulated remount.
7. **Test hooks.** `data-engine-status` on the card and
   `data-line-annotation` on the annotation span are test/automation hooks;
   they are not stored or exported.
8. **Performance dataset.** The release guard uses a representative 500-line
   mix, not a pathological dense matrix; the spec's 50 ms budget is applied to
   that representative notebook.
9. **Solver work caps.** Polynomial work is capped at degree 64, rational work
   at a degree-1 denominator and degree-2 numerator. Larger valid inputs are
   unsolved/silent. This is a worker-safety limit; the approved solver scope is
   unchanged.
10. **CI performance step.** The plan adds one `cargo test --release ...` step
    to CI to enforce D32; every other step stays as-is.

## Self-review against the spec

### Success criteria -> tasks

| Criterion | Coverage |
| --- | --- |
| 1 exact example + persistence | P1.7, P2.1-P2.4 |
| 2 prefix-only | P1.7, P2.4 |
| 3 incomplete not errors | P1.2, P1.7, P2.4 |
| 4 empty ignored | P1.7, P2.4 |
| 5 conflict keeps first value | P1.7, P2.2, P2.4 |
| 6 false equality | P1.7, P2.4 |
| 7 invalid | P1.2, P1.7, P2.4 |
| 8 division by zero | P1.5, P1.7, P2.4 |
| 9 quadratic `±` + narrowing | P1.8, P2.3, P2.4 |
| 10 non-symmetric set + insert largest | P1.3, P1.8, P2.3, P2.4 |
| 11 set conflict | P1.8, P2.4 |
| 12 one-set limit | P1.8, P2.4 |
| 13 formula after values | P1.7, P2.4 |
| 14 500-line/50 ms | P1.12 |
| 15 accessibility + Tab | P2.2, P2.3, P2.4 |
| 16 full gate + CI | P1.12, P2.6 |
| 17 README/AGENTS + foundation untouched | P2.5, P2.6 |
| 18 no network/telemetry; derived annotations | P2.1, P2.2, P2.5, P2.6 |

### Decision log -> tasks

| Decisions | Tasks |
| --- | --- |
| D1 (two phases) | Phase 1 / Phase 2 split |
| D2-D6 | P1.2, P1.7, P2.4, P2.5 |
| D7 | P1.5, P1.6 |
| D8-D13 | P1.5, P1.6, P1.7, P1.8, P1.9 |
| D14-D18 | P1.7, P1.8 |
| D19 | P1.3 |
| D20-D25 | P2.2, P2.3 |
| D26-D29 | P1.3, P1.7, P1.8, P2.2, P2.3 |
| D30-D32 | P1.10, P1.11, P1.12, P2.1 |
| D33-D36 | P1.11, P2.1 |
| D37 | P1.4 |
| D38 | P1.5, P1.6 |
| D39 | P1.9 |
| D40 | no version change anywhere |
| D41 | spec/plan dates and paths |
| D42 | P1.1-P1.9 module files |
| D43 | P2.6 |
| D44 | P2.5 |
| D45 | P1.3 constants |
| D46 | P2.2 |
| D47 | every task's single commit |

### Architecture -> tasks

Runtime shape (P1.10, P1.11, P2.1); statement model (P1.1, P1.2); evaluation
state (P1.7, P1.8); per-line algorithm (P1.7-P1.9); linear solving (P1.4,
P1.5); non-linear solving (P1.5, P1.6); sets/multiple roots (P1.8, P1.9); error
attribution (P1.7, P1.8); number formatting/equality (P1.3); worker protocol
(P1.11); Rust facade (P1.10); editor integration (P2.1-P2.3); visual design
(P2.2); testing (all tasks); documentation (P2.5).

### Consistency checks

- One public engine API: `evaluate(&[InputLine]) -> Vec<LineEvaluation>`;
  `Suggestion` is shared by the core and the protocol.
- One `LinearForm` convention: `sum(coeffs * var) + constant`; the linear
  system solves it equal to zero.
- One set model: `Value::Set` in the evaluator, at most one set entry, narrowed
  by direct assignments, linear single-unknown equations, and `refresh_values`
  reconciliation; `refresh_values` keeps the singleton source of truth
  consistent.
- One protocol shape: the spec's exact `LineInput`, `Suggestion`, `LineStatus`,
  `LineEvaluation`, `EngineRequest`, `EngineResponse`.
- One visual vocabulary: `text-on-surface-variant` ghost/dim, `border-loss` /
  `focus-within:outline-loss` / `text-loss` error, no opacity, no new tokens.
- File paths and commit messages are unique and ordered; no task edits the
  foundation spec/plan.

### Assumed decisions to review

18 of 47 decisions are `assumed`: D26-D29, D33-D42 and D44-D47. This plan adds
no new user-facing decisions. The clarifications above are the only points that
could reasonably be reviewed; they implement the approved decisions rather than
replace them.

## Open questions

None.
