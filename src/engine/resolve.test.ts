import { describe, expect, it } from 'vitest'
import { classifyLine, type Statement } from './classify'
import { createCasAdapter } from './cas/nerdamer'
import { buildSystem, type ConstraintSystem } from './constraints'
import { resolveSystem, type ResolvedScope } from './resolve'
import type { SolveSettings } from './types'

const settings: SolveSettings = { angleMode: 'radians', precision: 6, toleranceOverride: null }

function statementsOf(text: string): Statement[] {
  const cas = createCasAdapter(settings.angleMode)
  const statements: Statement[] = []
  let offset = 0
  for (const [index, line] of text.split('\n').entries()) {
    const classification = classifyLine(line, index, offset, cas)
    if ('line' in classification) {
      statements.push(classification)
    }
    offset += line.length + 1
  }
  return statements
}

function solve(text: string): { system: ConstraintSystem; scope: ResolvedScope } {
  const cas = createCasAdapter(settings.angleMode)
  const system = buildSystem(statementsOf(text))
  return { system, scope: resolveSystem(system, cas, settings) }
}

function resolvedValue(scope: ResolvedScope, symbol: string): number {
  const entry = scope.get(symbol)
  if (entry?.status !== 'resolved' || entry.value === undefined) {
    throw new Error(`expected ${symbol} to be resolved, got ${entry?.status ?? 'missing'}`)
  }
  return entry.value
}

function first<T>(items: T[]): T {
  const item = items[0]
  if (item === undefined) throw new Error('expected at least one item')
  return item
}

describe('buildSystem', () => {
  it('flags a later conflicting definition and points the fix at its RHS', () => {
    const text = 'a = b + 1\nb = 2\na = b + 5\nc = a * 2'
    const { system } = solve(text)
    expect(system.duplicates).toHaveLength(1)
    const duplicate = first(system.duplicates)
    expect(duplicate.kind).toBe('error')
    expect(duplicate.line).toBe(2)
    expect(duplicate.expected).toBe('b + 1')
    const fix = duplicate.fix
    if (fix === undefined) throw new Error('expected a fix range')
    expect(text.slice(fix.from, fix.to)).toBe('b + 5')
    expect(fix.insert).toBe('b + 1')
  })

  it('dedupes identical repeated statements silently', () => {
    const { system } = solve('a = b + 1\nb = 2\na = b + 1')
    expect(system.duplicates).toHaveLength(0)
  })

  it('flags conflicting repeated claims, keeping the first value', () => {
    const text = 'q = 1\nq = 2'
    const { system, scope } = solve(text)
    expect(system.duplicates).toHaveLength(1)
    const duplicate = first(system.duplicates)
    expect(duplicate.expected).toBe('1')
    const fix = duplicate.fix
    if (fix === undefined) throw new Error('expected a fix range')
    expect(text.slice(fix.from, fix.to)).toBe('2')
    expect(resolvedValue(scope, 'q')).toBe(1)
  })

  it('does not treat a claim against a definition as a duplicate', () => {
    const { system } = solve('t = 2.1\nt = sqrt(2 * h / g)\nh = 20\ng = 9.81')
    expect(system.duplicates).toHaveLength(0)
  })
})

describe('resolveSystem', () => {
  it('resolves backward references regardless of line order', () => {
    const backward = solve('v = u + a * t\nu = 3\na = 2\nt = 4')
    expect(resolvedValue(backward.scope, 'v')).toBeCloseTo(11, 10)
    const forward = solve('u = 3\na = 2\nt = 4\nv = u + a * t')
    expect(resolvedValue(forward.scope, 'v')).toBeCloseTo(11, 10)
  })

  it('resolves the ball-drop example from the definition, not the claim', () => {
    const text = 'h = 20\ng = 9.81\nt = sqrt(2 * h / g)\nt = 2.1\nv = g * t\nv = 20.6'
    const { system, scope } = solve(text)
    const fallTime = Math.sqrt((2 * 20) / 9.81)
    expect(resolvedValue(scope, 't')).toBeCloseTo(fallTime, 10)
    expect(resolvedValue(scope, 'v')).toBeCloseTo(9.81 * fallTime, 10)
    expect(resolvedValue(scope, 't')).not.toBe(2.1)
    expect(system.duplicates).toHaveLength(0)
    expect(system.bySymbol.get('t')).toHaveLength(2)
  })

  it('keeps every real root of a quadratic equation', () => {
    const { scope } = solve('x^2 = 4')
    const entry = scope.get('x')
    expect(entry?.status).toBe('multiple')
    expect(entry?.values).toEqual([2, -2])
  })

  it('solves a cyclic well-posed pair through the system solver', () => {
    const { scope } = solve('x = y + 1\ny = 2 * x - 3')
    expect(resolvedValue(scope, 'x')).toBeCloseTo(2, 10)
    expect(resolvedValue(scope, 'y')).toBeCloseTo(1, 10)
  })

  it('solves a nonlinear transcendental equation', () => {
    const { scope } = solve('2^x = 8')
    expect(resolvedValue(scope, 'x')).toBeCloseTo(3, 10)
  })

  it('marks an equation with no real solution unsolvable', () => {
    const { scope } = solve('x^2 = -1')
    expect(scope.get('x')?.status).toBe('unsolvable')
  })

  it('keeps an underdetermined equation symbolic', () => {
    const { scope } = solve('a + b = 10')
    expect(scope.get('a')?.status).toBe('symbolic')
    expect(scope.get('b')?.status).toBe('symbolic')
    const text = scope.get('a')?.symbolic ?? ''
    expect(text).toContain('a')
    expect(text).toContain('b')
  })

  it('substitutes known values into symbolic definitions', () => {
    const { scope } = solve('a = 10\nb = a + c')
    expect(resolvedValue(scope, 'a')).toBe(10)
    expect(scope.get('b')?.status).toBe('symbolic')
    expect(scope.get('b')?.symbolic).toContain('10')
    expect(scope.get('b')?.symbolic).toContain('c')
  })

  it('does not guess dependents of a multi-valued symbol', () => {
    const { scope } = solve('x^2 = 4\ny = x + 1')
    expect(scope.get('x')?.status).toBe('multiple')
    expect(scope.get('y')?.status).toBe('symbolic')
  })

  it('excludes conflicting duplicates from resolution', () => {
    const { scope } = solve('a = b + 1\nb = 2\na = b + 5\nc = a * 2')
    expect(resolvedValue(scope, 'a')).toBe(3)
    expect(resolvedValue(scope, 'c')).toBe(6)
  })
})
