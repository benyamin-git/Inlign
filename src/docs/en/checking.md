## One system, not a script

Every math line in a notebook is one constraint in a single shared system, so
line order carries no meaning. Backward references, coupled pairs, and values
used before they are written all resolve the same way. This is why a solution
can be drafted in the order you think of it rather than the order a compiler
would demand.

## The model and the claims

A definition such as `t = sqrt(2 * h / g)` is the model for its name. A claim
such as `t = 2.1` is a written value checked against that model, wherever
either line appears.

The first definition is authoritative. A later definition of the same name
with a different right-hand side is flagged as an error and offers the
authoritative right-hand side as the fix — repeated definitions are a common
source of silent, stale values, so they are treated as mistakes until you
resolve them. Writing the same right-hand side twice is silent and fine, and a
claim that shares a name with a definition is never treated as a duplicate:
checking the claim is exactly what should happen.

When no definition exists, the first claim becomes the model, and later
conflicting claims are flagged.

## Written precision

A claim is accepted when the computed value differs from the written value by
at most half of the last decimal place the claim wrote:

- `v = 19.8` against a computed 19.809 is accepted: the difference (0.009) is
  inside half of 0.1.
- `t = 2.1` against a computed 2.019 is flagged: the difference (0.081) is
  outside half of 0.1.

Why this rule: values people write down are almost always rounded to the
precision they cared about. Comparing at that precision accepts honest
rounding while still catching a value that was copied, scaled, or transcribed
wrong. A flag shows its expected value with two extra decimals beyond what was
written, so the gap is visible.

If written precision is the wrong yardstick — for example when a formula
produces numbers far larger than the digits suggest — settings offer a
relative tolerance override instead.

## Fixing a flag

A conflict marker shows the expected value and, on hover or tap, an
explanation. The fix replaces just the right-hand side with the computed value
as an ordinary, undoable edit. Inlign never changes your text silently: a flag
disappears because the text was corrected, not because the check was skipped.

## Quiet by design

- A line that cannot be parsed is prose, not an error; notes and drafts stay
  clean.
- An unresolved symbol shows its symbolic form instead of a guess, so a
  half-finished document still shows how far it has been simplified.
- An equation with no real solution, and one the solver cannot handle, becomes
  a quiet error marker.
- Several real solutions are all kept; a name that depends on a multi-valued
  solution stays symbolic rather than assuming one branch.

Result text shows the value at the configured precision, and the words around
it come from the app, never from your document.
