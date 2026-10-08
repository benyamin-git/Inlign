import type { Statement } from './classify'
import type { Annotation, AnnotationFix } from './types'

export interface ConstraintSystem {
  statements: Statement[]
  bySymbol: Map<string, Statement[]>
  duplicates: Annotation[]
}

export function rhsFix(statement: Statement, insert: string): AnnotationFix {
  const equals = statement.text.indexOf('=')
  let start = equals + 1
  while (statement.text[start] === ' ') start += 1
  const from = statement.from + start
  return { from, to: from + (statement.rhsText?.length ?? 0), insert }
}

// A3: the first definition is authoritative, else the first claim; later
// conflicting statements are flagged, identical RHS deduped silently.
export function buildSystem(statements: Statement[]): ConstraintSystem {
  const bySymbol = new Map<string, Statement[]>()
  for (const statement of statements) {
    if (statement.symbol === null) continue
    const candidates = bySymbol.get(statement.symbol)
    if (candidates === undefined) bySymbol.set(statement.symbol, [statement])
    else candidates.push(statement)
  }

  const duplicates: Annotation[] = []
  for (const candidates of bySymbol.values()) {
    const definitions = candidates.filter((statement) => statement.kind === 'definition')
    const model = definitions[0] ?? candidates[0]
    if (model === undefined) continue
    for (const statement of candidates) {
      if (statement === model) continue
      if (definitions.length > 0 && statement.kind === 'claim') continue
      if (statement.rhsText === model.rhsText) continue
      const expected = model.rhsText ?? ''
      duplicates.push({
        line: statement.line,
        from: statement.from,
        to: statement.to,
        kind: 'error',
        text: expected,
        expected,
        fix: rhsFix(statement, expected),
      })
    }
  }

  return { statements, bySymbol, duplicates }
}
