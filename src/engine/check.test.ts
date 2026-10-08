import { describe, expect, it } from 'vitest'
import { buildAnnotations } from './annotate'
import { checkClaims } from './check'
import { classifyLine, type Statement } from './classify'
import { createCasAdapter } from './cas/nerdamer'
import { buildSystem } from './constraints'
import { formatNumber, formatSolutions, writtenTolerance } from './format'
import { resolveSystem } from './resolve'
import type { Annotation, SolveSettings } from './types'

const baseSettings: SolveSettings = { angleMode: 'radians', precision: 12, toleranceOverride: null }

function statementsOf(text: string): Statement[] {
  const cas = createCasAdapter(baseSettings.angleMode)
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

function solve(text: string, settings: SolveSettings = baseSettings) {
  const cas = createCasAdapter(settings.angleMode)
  const system = buildSystem(statementsOf(text))
  const scope = resolveSystem(system, cas, settings)
  const claims = checkClaims(system, scope, cas, settings)
  return {
    system,
    scope,
    claims,
    annotations: buildAnnotations(system, scope, claims, cas, settings),
  }
}

function annotationAt(annotations: Annotation[], line: number): Annotation | undefined {
  return annotations.find((annotation) => annotation.line === line)
}

describe('formatNumber', () => {
  it('rounds to the configured significant digits and trims zeros', () => {
    const fallTime = Math.sqrt(40 / 9.81)
    expect(formatNumber(fallTime, 12)).toBe('2.01927510938')
    expect(formatNumber(fallTime, 4)).toBe('2.019')
    expect(formatNumber(4, 12)).toBe('4')
    expect(formatNumber(1 / 3, 12)).toBe('0.333333333333')
  })

  it('absorbs floating point noise within the displayed digits', () => {
    expect(formatNumber(0.1 + 0.2, 12)).toBe('0.3')
  })

  it('handles negative and zero values', () => {
    expect(formatNumber(-2.5, 12)).toBe('-2.5')
    expect(formatNumber(0, 12)).toBe('0')
  })
})

describe('formatSolutions', () => {
  it('joins values with or and keeps them sorted', () => {
    expect(formatSolutions([2, -2], 12)).toBe('2 or -2')
  })

  it('caps at four values and counts the rest', () => {
    expect(formatSolutions([2, -2, 3, 1, 5, 6], 12)).toBe('2 or -2 or 3 or 1 +2 more')
  })

  it('returns an empty string for no values', () => {
    expect(formatSolutions([], 12)).toBe('')
  })
})

describe('writtenTolerance', () => {
  it('is half the last written decimal place', () => {
    expect(writtenTolerance('2.02', 0)).toBe(0.005)
    expect(writtenTolerance('2.0198', 0)).toBe(0.00005)
    expect(writtenTolerance('2.10', 0)).toBe(0.005)
  })

  it('is 0.5 for integers and digit-free text', () => {
    expect(writtenTolerance('2', 0)).toBe(0.5)
    expect(writtenTolerance('pi', 0)).toBe(0.5)
  })

  it('never drops below floating point noise for large resolved values', () => {
    const tolerance = writtenTolerance('1.414213562373095', 1.4142135623730951)
    expect(tolerance).toBeGreaterThan(1e-13)
    expect(tolerance).toBeLessThan(1e-11)
  })
})

describe('checkClaims', () => {
  it('passes a claim within its written tolerance', () => {
    const { annotations } = solve('y = 1.0099\nx = y * 2\nx = 2.02')
    expect(annotationAt(annotations, 2)?.kind).toBe('result')
  })

  it('flags a claim outside its written tolerance', () => {
    const text = 'y = 1.0099\nx = y * 2\nx = 2.019'
    const { annotations } = solve(text)
    const conflict = annotationAt(annotations, 2)
    expect(conflict?.kind).toBe('conflict')
    expect(conflict?.expected).toBe('2.0198')
    const fix = conflict?.fix
    if (fix === undefined) throw new Error('expected a fix range')
    expect(text.slice(fix.from, fix.to)).toBe('2.019')
    expect(fix.insert).toBe('2.0198')
  })

  it('switches to a relative tolerance with the override', () => {
    const document = 'y = 1.0099\nx = y * 2\nx = 2.0'
    const written = solve(document)
    expect(annotationAt(written.annotations, 2)?.kind).toBe('result')
    const overridden = solve(document, { ...baseSettings, toleranceOverride: 0.001 })
    expect(annotationAt(overridden.annotations, 2)?.kind).toBe('conflict')
    const within = solve('y = 1.0099\nx = y * 2\nx = 2.02', {
      ...baseSettings,
      toleranceOverride: 0.001,
    })
    expect(annotationAt(within.annotations, 2)?.kind).toBe('result')
  })

  it('formats conflict expected at the claim precision and fixes the RHS range', () => {
    const text = 'h = 20\ng = 9.81\nt = sqrt(2 * h / g)\nt = 2.1'
    const { annotations } = solve(text)
    const conflict = annotationAt(annotations, 3)
    expect(conflict?.kind).toBe('conflict')
    expect(conflict?.text).toBe('2.019')
    expect(conflict?.expected).toBe('2.019')
    const fix = conflict?.fix
    if (fix === undefined) throw new Error('expected a fix range')
    expect(text.slice(fix.from, fix.to)).toBe('2.1')
    expect(fix.insert).toBe('2.019')
  })
})

describe('buildAnnotations', () => {
  it('emits one result for a definition and evaluates expressions', () => {
    const { annotations } = solve('t = sqrt(2 * h / g)\nh = 20\ng = 9.81\n3 + 4')
    expect(annotationAt(annotations, 0)?.kind).toBe('result')
    expect(annotationAt(annotations, 0)?.text).toBe('2.01927510938')
    expect(annotationAt(annotations, 3)?.kind).toBe('result')
    expect(annotationAt(annotations, 3)?.text).toBe('7')
  })

  it('shows an authoritative claim as a result', () => {
    const { annotations } = solve('q = 1')
    expect(annotationAt(annotations, 0)?.kind).toBe('result')
    expect(annotationAt(annotations, 0)?.text).toBe('1')
  })

  it('keeps duplicates as errors with the first RHS as the fix', () => {
    const text = 'a = b + 1\nb = 2\na = b + 5'
    const { annotations } = solve(text)
    const duplicate = annotationAt(annotations, 2)
    expect(duplicate?.kind).toBe('error')
    expect(duplicate?.expected).toBe('b + 1')
    const fix = duplicate?.fix
    if (fix === undefined) throw new Error('expected a fix range')
    expect(text.slice(fix.from, fix.to)).toBe('b + 5')
  })

  it('formats multiple equation solutions with the unknown', () => {
    const { annotations } = solve('x^2 = 4')
    expect(annotationAt(annotations, 0)?.kind).toBe('result')
    expect(annotationAt(annotations, 0)?.text).toBe('x = 2 or -2')
  })

  it('flags an equation with no real solution as an error', () => {
    const { annotations } = solve('x^2 = -1')
    expect(annotationAt(annotations, 0)?.kind).toBe('error')
  })

  it('shows symbolic text for unresolved definitions and equations', () => {
    const definition = solve('b = a + c')
    expect(annotationAt(definition.annotations, 0)?.kind).toBe('unresolved')
    expect(annotationAt(definition.annotations, 0)?.text).toContain('c')
    const equation = solve('a + b = 10')
    expect(annotationAt(equation.annotations, 0)?.kind).toBe('unresolved')
    expect(annotationAt(equation.annotations, 0)?.text).toContain('a')
  })

  it('keeps an unresolved expression symbolic', () => {
    const { annotations } = solve('x + 1')
    expect(annotationAt(annotations, 0)?.kind).toBe('unresolved')
    expect(annotationAt(annotations, 0)?.text).toBe('1+x')
  })

  it('checks constant equations that resolve to no unknowns', () => {
    const holding = solve('2 + 2 = 4')
    expect(holding.annotations).toHaveLength(0)
    const contradicted = solve('2 + 2 = 5')
    expect(annotationAt(contradicted.annotations, 0)?.kind).toBe('error')
  })
})
