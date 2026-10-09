export const WELCOME_TITLE = 'Welcome'

export const WELCOME_CONTENT = `# Welcome to Inlign.

# Write math like you would on paper. Every math line is one constraint in
# a shared system, and written values are checked against the formulas
# they depend on. Results appear on the line your cursor is on.

# A ball is dropped from h = 20 with g = 9.81:

h = 20
g = 9.81
t = sqrt(2 * h / g)
v = g * t

# This claim is wrong on purpose. The underline flags it; put the cursor on
# the line to see the computed value and a one-click fix:

t = 2.1

# Written values are compared at the precision you wrote them, so this
# rounded result is accepted:

v = 19.8

# Percent literals and mod() are built in:

discount = 15%
price = 80
sale = price * (1 - discount)
remainder = mod(38, 5)

# Change any number and click a line to watch its result update.
`
