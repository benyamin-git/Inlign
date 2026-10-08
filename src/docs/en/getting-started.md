Inlign is a notepad that computes. You write plain text; lines that contain
math are evaluated, and every value you write down is checked against the
formulas around it. Nothing hides behind special syntax — a notebook is just
the text you typed.

## Your first document

Type these lines, one statement per line:

```
h = 20
g = 9.81
t = sqrt(2 * h / g)
v = g * t
```

Each complete line becomes one constraint in a single shared system. The order
of the lines does not matter: a formula may refer to a value that appears
further down, and `v` could be written before `t`. Results appear at the end
of each line as you type.

## Catching a mistake

Add this line to the document above:

```
t = 2.1
```

Inlign compares the written `2.1` with the value the formula produces (about
2.019) and marks the line instead of trusting either side. Hover or tap the
marker to see the expected value, then use the fix to replace the written
number with the computed one. Inlign never edits your text on its own —
mistakes stay visible until you decide what to do with them.

## Rounded values are fine

This line is accepted even though `g * t` is not exactly 19.8:

```
v = 19.8
```

A claim is checked at the precision you wrote it: a difference within half of
the last written decimal place counts as rounding, not as an error. That rule
keeps drafted, rounded results from turning into noise. See "How checking
works" for the details and for the tolerance override in settings.

## Writing prose

A line that starts with `#` is always prose, and a line that cannot be read as
math is quietly left alone:

```
# Projectile drop, initial velocity zero
h = 20
The fall takes about two seconds.
```

## The rest of the app

- Notebooks autosave while you type; the title is edited in the top bar.
- New notebook (Mod+N), the notebook switcher (Mod+K), export (Mod+E),
  settings (Mod+,), and this help (Mod+/) are in the top bar and on shortcuts.
- Settings hold display precision, the tolerance override, angle mode
  (radians or degrees), theme, and accent.
- The welcome notebook is a small worked example; everything in it can be
  edited or deleted.
