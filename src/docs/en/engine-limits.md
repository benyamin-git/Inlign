## The engine behind Inlign

Inlign hands each document to a computer algebra system through a narrow
adapter. That boundary keeps the algebra system replaceable, and it also
defines what is guaranteed, what is attempted, and what is deliberately left
out.

## Guaranteed

- Arithmetic, powers, roots, factorials, percentages, and constants.
- Fractions and powers stay exact internally while solving; only display is
  decimal, at the configured precision.
- Linear equations and the polynomial forms the solver supports, including
  quadratics with real roots.
- Constant expressions evaluate immediately.
- `pi` and `e` are recognized constants.

## Best-effort

- **Nonlinear and transcendental equations** are attempted with bounded
  numeric root finding. `cos(x) = x` usually solves; other cases may stay
  unresolved instead of producing a wrong answer.
- **Coupled systems** solve exactly for linear forms and numerically for
  nonlinear ones, with an iteration cap. A non-converging system leaves its
  names symbolic.
- **Underdetermined names** stay symbolic by design: Inlign shows what is
  known and waits rather than guessing.
- **Dependents of multi-valued solutions** stay symbolic too; picking one
  branch would silently discard the other roots.

## Not supported in v1

- Complex numbers: `sqrt(-1)` has no value here and is shown unresolved,
  never as `i`.
- Units and dimensional analysis — numbers carry no domain meaning.
- Matrices and vectors.
- Graphs and plots.
- User-defined functions, loops, and conditionals; Inlign computes a
  document, it is not a scripting language.
- LaTeX or typeset math rendering.
- Math inside a prose sentence: a statement must be a whole line.

Every entry is a deliberate candidate for a later version. The adapter
boundary and the registry-driven documentation exist so those become
additions rather than rewrites.

## Limits in practice

- Solving runs in the background and is debounced, keeping typing smooth to
  roughly five hundred lines.
- Only real roots are reported, up to four per equation plus a count.
- A result is either a computed value or an honest unresolved marker; the
  engine never guesses a number.
