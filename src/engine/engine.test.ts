import { describe, expect, it } from 'vitest'
import { solveDocument } from './index'
import { formatNumber } from './format'
import type { Annotation, SolveSettings } from './types'

const settings: SolveSettings = { angleMode: 'radians', precision: 12, toleranceOverride: null }

function annotationAt(annotations: Annotation[], line: number): Annotation | undefined {
  return annotations.find((annotation) => annotation.line === line)
}

describe('solveDocument', () => {
  it('produces the worked example annotations end to end', () => {
    const text = ['h = 20', 'g = 9.81', 't = sqrt(2 * h / g)', 't = 2.1', 'v = g * t'].join('\n')
    const annotations = solveDocument(text, settings)
    expect(annotations.map((annotation) => annotation.line)).toEqual([0, 1, 2, 3, 4])
    expect(annotationAt(annotations, 0)?.text).toBe('20')
    expect(annotationAt(annotations, 1)?.text).toBe('9.81')
    expect(annotationAt(annotations, 2)?.text).toBe('2.01927510938')
    const conflict = annotationAt(annotations, 3)
    expect(conflict?.kind).toBe('conflict')
    expect(conflict?.expected).toBe('2.019')
    const fix = conflict?.fix
    if (fix === undefined) throw new Error('expected a fix range')
    expect(text.slice(fix.from, fix.to)).toBe('2.1')
    expect(fix.insert).toBe('2.019')
    expect(annotationAt(annotations, 4)?.text).toBe(formatNumber(9.81 * Math.sqrt(40 / 9.81), 12))
  })

  it('keeps prose and blank lines annotation-free', () => {
    const annotations = solveDocument('# note\n\n2 + 2', settings)
    expect(annotations).toHaveLength(1)
    expect(annotations[0]?.line).toBe(2)
    expect(annotations[0]?.text).toBe('4')
  })

  it('keeps offsets correct with CRLF line endings', () => {
    const text = 'h = 20\r\ng = 9.81\r\nt = sqrt(2 * h / g)\r\nt = 2.1'
    const annotations = solveDocument(text, settings)
    const conflict = annotationAt(annotations, 3)
    const fix = conflict?.fix
    if (fix === undefined) throw new Error('expected a fix range')
    expect(text.slice(fix.from, fix.to)).toBe('2.1')
  })

  it('never throws on malformed input', () => {
    expect(() => solveDocument('sin(\n)=(\n$$$', settings)).not.toThrow()
    expect(solveDocument('sin(', settings)).toEqual([])
  })

  it('returns nothing for empty text', () => {
    expect(solveDocument('', settings)).toEqual([])
  })
})
