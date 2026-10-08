import type { CasAdapter } from './cas/types'
import type { Statement } from './classify'
import type { ConstraintSystem } from './constraints'
import { formatNumber, formatSolutions } from './format'
import type { ResolvedScope, ResolvedSymbol } from './resolve'
import type { Annotation, SolveSettings } from './types'

function valueText(entry: ResolvedSymbol, precision: number): string {
  if (entry.status === 'resolved' && entry.value !== undefined) {
    return formatNumber(entry.value, precision)
  }
  if (entry.status === 'multiple' && entry.values !== undefined) {
    return formatSolutions(entry.values, precision)
  }
  return entry.symbolic ?? ''
}

export function buildAnnotations(
  system: ConstraintSystem,
  scope: ResolvedScope,
  claimAnnotations: Annotation[],
  cas: CasAdapter,
  settings: SolveSettings,
): Annotation[] {
  const precision = settings.precision
  const duplicates = new Map(system.duplicates.map((annotation) => [annotation.line, annotation]))
  const conflicts = new Map(claimAnnotations.map((annotation) => [annotation.line, annotation]))

  const numeric: Record<string, number> = {}
  const textual: Record<string, string> = {}
  for (const [symbol, entry] of scope) {
    if (entry.status === 'resolved' && entry.value !== undefined) {
      numeric[symbol] = entry.value
      textual[symbol] = String(entry.value)
    }
  }

  const resolvedStatus = (entry: ResolvedSymbol | undefined): boolean =>
    entry?.status === 'resolved' || entry?.status === 'multiple'

  const annotationFor = (statement: Statement): Annotation | undefined => {
    const range = { line: statement.line, from: statement.from, to: statement.to }
    if (statement.kind === 'expression') {
      const value = cas.evaluate(statement.node, numeric)
      if (value !== null) return { ...range, kind: 'result', text: formatNumber(value, precision) }
      return {
        ...range,
        kind: 'unresolved',
        text: cas.toString(cas.substitute(statement.node, textual)),
      }
    }
    if (statement.kind === 'claim' || statement.kind === 'definition') {
      if (statement.symbol === null) return undefined
      const entry = scope.get(statement.symbol)
      if (entry === undefined) return undefined
      if (resolvedStatus(entry)) {
        return { ...range, kind: 'result', text: valueText(entry, precision) }
      }
      if (entry.status === 'symbolic') {
        return { ...range, kind: 'unresolved', text: entry.symbolic ?? '' }
      }
      return { ...range, kind: 'unresolved', text: '' }
    }
    const free = cas.freeSymbols(statement.node)
    const entries = free.map((name) => scope.get(name))
    if (entries.length > 0 && entries.every(resolvedStatus)) {
      const index = entries.findIndex(resolvedStatus)
      const name = free[index]
      const entry = entries[index]
      if (name !== undefined && entry !== undefined) {
        return { ...range, kind: 'result', text: `${name} = ${valueText(entry, precision)}` }
      }
    }
    const symbolic = entries.find((entry) => entry?.status === 'symbolic')
    if (symbolic !== undefined) {
      return { ...range, kind: 'unresolved', text: symbolic.symbolic ?? '' }
    }
    if (entries.some((entry) => entry?.status === 'unsolvable')) {
      return { ...range, kind: 'error', text: '' }
    }
    const value = cas.evaluate(statement.node, numeric)
    if (value !== null && Math.abs(value) > 1e-12) {
      return { ...range, kind: 'error', text: '' }
    }
    return undefined
  }

  const annotations: Annotation[] = []
  for (const statement of system.statements) {
    const conflict = conflicts.get(statement.line)
    if (conflict !== undefined) {
      annotations.push(conflict)
      continue
    }
    const duplicate = duplicates.get(statement.line)
    if (duplicate !== undefined) {
      annotations.push(duplicate)
      continue
    }
    const annotation = annotationFor(statement)
    if (annotation !== undefined) annotations.push(annotation)
  }
  return annotations
}
