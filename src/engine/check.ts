import type { CasAdapter } from './cas/types'
import { rhsFix, type ConstraintSystem } from './constraints'
import { formatExpected, writtenTolerance } from './format'
import type { ResolvedScope } from './resolve'
import type { Annotation, SolveSettings } from './types'

export function checkClaims(
  system: ConstraintSystem,
  scope: ResolvedScope,
  cas: CasAdapter,
  settings: SolveSettings,
): Annotation[] {
  const excluded = new Set(system.duplicates.map((annotation) => annotation.line))
  const conflicts: Annotation[] = []
  for (const statement of system.statements) {
    if (statement.kind !== 'claim' || statement.symbol === null || statement.rhsText === null) {
      continue
    }
    if (excluded.has(statement.line)) continue
    const candidates = system.bySymbol.get(statement.symbol) ?? []
    const usable = candidates.filter((candidate) => !excluded.has(candidate.line))
    const model = usable.find((candidate) => candidate.kind === 'definition') ?? usable[0]
    if (model === statement) continue
    const entry = scope.get(statement.symbol)
    if (entry?.status !== 'resolved' || entry.value === undefined) continue
    const claimed = cas.evaluate(cas.parse(statement.rhsText), {})
    if (claimed === null) continue
    const tolerance =
      settings.toleranceOverride !== null
        ? Math.abs(settings.toleranceOverride) * Math.abs(entry.value)
        : writtenTolerance(statement.rhsText, entry.value)
    if (Math.abs(claimed - entry.value) <= tolerance) continue
    const expected = formatExpected(entry.value, statement.rhsText)
    conflicts.push({
      line: statement.line,
      from: statement.from,
      to: statement.to,
      kind: 'conflict',
      text: expected,
      expected,
      fix: rhsFix(statement, expected),
    })
  }
  return conflicts
}
