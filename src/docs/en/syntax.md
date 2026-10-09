## Lines

Inlign reads one whole line at a time. A line is blank, prose, or exactly one
math statement; math inside a sentence is not extracted. Blank lines separate
paragraphs, and any line that does not parse as math quietly becomes prose —
a notepad should not scold you for typing notes.

A line that starts with `#` is always prose, whatever follows it.

## Statements

There are four statement shapes, decided by what stands left of the `=`. The
value a statement computes appears at the end of the line while your cursor is
on it, and the rest of the notebook stays out of the way until you click into
a line.

**Claim** — a single name equals an expression with no free names:

```
h = 20
rate = 3.5%
half = 1/2
```

The value is what you assert, and Inlign checks it against the rest of the
document (see "How checking works"). Claims are the values you want verified.

**Definition** — a single name equals an expression that refers to other
names:

```
t = sqrt(2 * h / g)
area = pi * r^2
```

The line defines how the name is computed. A definition is the model for its
name; a claim with the same name is checked against it.

**Equation** — the left side is not a single name, so the line is solved for
its unknown:

```
2 * x + 3 = 11
x^2 = 2
```

All real solutions are kept. Up to four are shown at the end of the line,
followed by a count when there are more.

**Expression** — a line with no `=` at all is evaluated and its value shown;
nothing is bound:

```
2 + 3
sqrt(2)
```

## Names

A name starts with a letter or an underscore and continues with letters,
digits, or underscores. Names are case-sensitive: `V` and `v` are different.

## Operators

- `+ - * /` arithmetic
- `^` or `**` powers, e.g. `2^10`
- `!` factorial, e.g. `5!`
- `%` a percent literal: `15%` is 0.15, so `80 * 15%` is 12
- `mod(a, b)` the remainder: `mod(38, 5)` is 3
- parentheses group as usual

Percent is a literal because that is calculator intuition; `mod(a, b)` keeps
the mathematical word for the related remainder operation unambiguous.

## Functions

- `sqrt(x)`, `abs(x)`, `exp(x)`
- `log(x)` the natural logarithm, `log(x, base)`, and `log10(x)`
- `sin`, `cos`, `tan`, `sec`, `csc`, `cot`
- `asin`, `acos`, `atan`, `asec`, `acsc`, `acot`, and `atan2(y, x)`
- `mod(a, b)`, `min(a, b, …)`, `max(a, b, …)`
- `floor(x)`, `ceil(x)`, `round(x)`

Angles are radians by default. The degrees setting converts trigonometric
arguments and inverse results at the adapter boundary, so `sin(30)` is 0.5 in
degrees mode.

## Constants

`pi` and `e` are built in and never need definitions.

## Numbers

Integers, decimals, and scientific notation (`1e3`) are accepted. Fractions
stay exact while solving; results are displayed with the precision set in
settings — significant digits with trailing zeros trimmed.
