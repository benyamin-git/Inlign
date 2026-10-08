import type { CasAdapter, CasNode } from './cas/types'
import type { Statement } from './classify'
import type { ConstraintSystem } from './constraints'
import type { SolveSettings } from './types'

export interface ResolvedSymbol {
  status: 'resolved' | 'multiple' | 'symbolic' | 'unsolvable'
  value?: number
  values?: number[]
  symbolic?: string
}

export type ResolvedScope = Map<string, ResolvedSymbol>

const ROOT_EPSILON = 1e-9

function uniqueRoots(roots: number[]): number[] {
  const sorted = [...roots].sort((a, b) => b - a)
  const unique: number[] = []
  for (const root of sorted) {
    const seen = unique.some(
      (existing) =>
        Math.abs(existing - root) <= ROOT_EPSILON * Math.max(1, Math.abs(existing), Math.abs(root)),
    )
    if (!seen) unique.push(root)
  }
  return unique
}

export function resolveSystem(
  system: ConstraintSystem,
  cas: CasAdapter,
  settings: SolveSettings,
): ResolvedScope {
  void settings // resolution is settings-free today; the parameter keeps the pipeline signature stable

  const statements = system.statements
  const excluded = new Set(system.duplicates.map((annotation) => annotation.line))

  const models = new Map<string, Statement>()
  for (const [symbol, candidates] of system.bySymbol) {
    const usable = candidates.filter((statement) => !excluded.has(statement.line))
    const model = usable.find((statement) => statement.kind === 'definition') ?? usable[0]
    if (model !== undefined) models.set(symbol, model)
  }

  const freeCache = new Map<Statement, string[]>()
  const freeSymbols = (statement: Statement): string[] => {
    let symbols = freeCache.get(statement)
    if (symbols === undefined) {
      symbols = cas.freeSymbols(statement.node)
      freeCache.set(statement, symbols)
    }
    return symbols
  }

  const numeric = new Map<string, number>()
  const multiple = new Map<string, number[]>()
  const unsolvable = new Set<string>()

  const numericRecord = (): Record<string, number> => Object.fromEntries(numeric)
  const textualRecord = (): Record<string, string> =>
    Object.fromEntries([...numeric].map(([symbol, value]) => [symbol, String(value)]))

  const settled = (symbol: string): boolean =>
    numeric.has(symbol) || multiple.has(symbol) || unsolvable.has(symbol)

  const unknownsOf = (statement: Statement): string[] => {
    const self = statement.kind === 'definition' ? statement.symbol : null
    return freeSymbols(statement).filter(
      (symbol) =>
        symbol !== self && !numeric.has(symbol) && !multiple.has(symbol) && !unsolvable.has(symbol),
    )
  }

  const record = (symbol: string, roots: number[]): void => {
    const unique = uniqueRoots(roots)
    if (unique.length === 0) unsolvable.add(symbol)
    else if (unique.length === 1) {
      const only = unique[0]
      if (only !== undefined) numeric.set(symbol, only)
    } else multiple.set(symbol, unique)
  }

  const attempt = (statement: Statement, symbol: string): boolean => {
    const roots = cas.solveFor(cas.substitute(statement.node, textualRecord()), symbol)
    const values: number[] = []
    let pending = false
    for (const root of roots) {
      const value = cas.evaluate(root, numericRecord())
      if (value !== null) values.push(value)
      else if (cas.freeSymbols(root).length > 0) pending = true
    }
    if (pending) return false
    record(symbol, values)
    return true
  }

  const runPasses = (): void => {
    let progress = true
    while (progress) {
      progress = false
      for (const statement of statements) {
        if (statement.kind === 'definition') {
          const symbol = statement.symbol
          if (symbol === null || settled(symbol) || excluded.has(statement.line)) continue
          if (models.get(symbol) !== statement) continue
          if (unknownsOf(statement).length > 0) continue
          if (attempt(statement, symbol)) progress = true
        } else if (statement.kind === 'equation') {
          const unknowns = unknownsOf(statement)
          if (unknowns.length !== 1) continue
          const symbol = unknowns[0]
          if (symbol === undefined || settled(symbol)) continue
          if (attempt(statement, symbol)) progress = true
        }
      }
    }
  }

  const solveCoupled = (): void => {
    const candidates: Array<{ node: CasNode; symbols: string[] }> = []
    for (const statement of statements) {
      if (statement.kind === 'definition') {
        const symbol = statement.symbol
        if (symbol === null || settled(symbol) || excluded.has(statement.line)) continue
        if (models.get(symbol) !== statement) continue
        const unknowns = unknownsOf(statement)
        if (unknowns.length === 0) continue
        candidates.push({ node: statement.node, symbols: [symbol, ...unknowns] })
      } else if (statement.kind === 'equation') {
        const unknowns = unknownsOf(statement)
        if (unknowns.length < 2) continue
        candidates.push({ node: statement.node, symbols: unknowns })
      }
    }
    if (candidates.length === 0) return

    const adjacency = new Map<string, Set<string>>()
    for (const candidate of candidates) {
      for (const symbol of candidate.symbols) {
        let neighbors = adjacency.get(symbol)
        if (neighbors === undefined) {
          neighbors = new Set()
          adjacency.set(symbol, neighbors)
        }
        for (const other of candidate.symbols) {
          if (other !== symbol) neighbors.add(other)
        }
      }
    }

    const visited = new Set<string>()
    for (const [start] of adjacency) {
      if (visited.has(start)) continue
      const component = new Set<string>()
      const queue = [start]
      visited.add(start)
      while (queue.length > 0) {
        const current = queue.pop()
        if (current === undefined) continue
        component.add(current)
        const neighbors = adjacency.get(current)
        if (neighbors === undefined) continue
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push(neighbor)
          }
        }
      }

      const equations = candidates
        .filter((candidate) => candidate.symbols.every((symbol) => component.has(symbol)))
        .map((candidate) => cas.substitute(candidate.node, textualRecord()))
      const solution = cas.solveSystem(equations, [...component].sort())
      if (solution === null) continue
      for (const symbol of component) {
        const values = solution[symbol]
        if (values !== undefined && values.length > 0) record(symbol, values)
      }
    }
  }

  for (const [symbol] of system.bySymbol) {
    const model = models.get(symbol)
    if (model?.kind !== 'claim' || model.rhsText === null) continue
    const value = cas.evaluate(cas.parse(model.rhsText), {})
    if (value !== null) numeric.set(symbol, value)
  }

  runPasses()
  solveCoupled()
  runPasses()

  const symbolicText = (symbol: string): string => {
    const model = models.get(symbol)
    if (model !== undefined && model.rhsText !== null) {
      return cas.toString(cas.substitute(cas.parse(model.rhsText), textualRecord()))
    }
    const owner = statements.find((statement) => freeSymbols(statement).includes(symbol))
    if (owner !== undefined) {
      return cas.toString(cas.substitute(owner.node, textualRecord()))
    }
    return symbol
  }

  const relevant = new Set<string>()
  for (const statement of statements) {
    if (statement.symbol !== null) relevant.add(statement.symbol)
    for (const symbol of freeSymbols(statement)) relevant.add(symbol)
  }

  const scope: ResolvedScope = new Map()
  for (const symbol of relevant) {
    const value = numeric.get(symbol)
    if (value !== undefined) {
      scope.set(symbol, { status: 'resolved', value })
      continue
    }
    const values = multiple.get(symbol)
    if (values !== undefined) {
      scope.set(symbol, { status: 'multiple', values })
      continue
    }
    if (unsolvable.has(symbol)) {
      scope.set(symbol, { status: 'unsolvable' })
      continue
    }
    scope.set(symbol, { status: 'symbolic', symbolic: symbolicText(symbol) })
  }
  return scope
}
