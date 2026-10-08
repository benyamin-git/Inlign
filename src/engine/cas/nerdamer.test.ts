import { describe, expect, it } from 'vitest'
import { createCasAdapter } from './nerdamer'
import { CasParseError, type CasAdapter } from './types'

const radians = createCasAdapter('radians')
const degrees = createCasAdapter('degrees')

function numericRoots(cas: CasAdapter, equation: string, symbol: string): Array<number | null> {
  return cas.solveFor(cas.parse(equation), symbol).map((root) => cas.evaluate(root, {}))
}

function numbers(values: Array<number | null>): number[] {
  return values.map((value) => {
    if (value === null) throw new Error('expected a numeric root')
    return value
  })
}

describe('nerdamer adapter — parsing and evaluation', () => {
  it('parses and evaluates sqrt with a scope', () => {
    const node = radians.parse('sqrt(2 * h / g)')
    expect(radians.evaluate(node, { h: 20, g: 9.81 })).toBeCloseTo(2.0192751093846, 10)
  })

  it('evaluates a constant expression immediately', () => {
    expect(radians.evaluate(radians.parse('2 + 2'), {})).toBe(4)
  })

  it('treats % as a percent literal', () => {
    expect(radians.evaluate(radians.parse('50%'), {})).toBe(0.5)
  })

  it('evaluates mod', () => {
    expect(radians.evaluate(radians.parse('mod(7, 3)'), {})).toBe(1)
  })

  it('evaluates exact rationals numerically', () => {
    expect(radians.evaluate(radians.parse('1/2'), {})).toBe(0.5)
  })

  it('returns null when free symbols remain', () => {
    expect(radians.evaluate(radians.parse('x + 1'), {})).toBeNull()
  })

  it('evaluates with scope values substituted', () => {
    expect(radians.evaluate(radians.parse('x + 1'), { x: 2 })).toBe(3)
  })

  it('returns null for complex results', () => {
    expect(radians.evaluate(radians.parse('sqrt(-1)'), {})).toBeNull()
  })

  it('returns null when scope values make evaluation fail', () => {
    expect(radians.evaluate(radians.parse('1/x'), { x: 0 })).toBeNull()
  })

  it('stringifies to nerdamer text', () => {
    expect(radians.toString(radians.parse('x^2'))).toBe('x^2')
  })

  it('rejects unparsable input with CasParseError', () => {
    for (const input of ['', '2 +', '1/0', 'the total is 5', 'x = 5', '[1, 2]']) {
      expect(() => radians.parse(input), `parse(${JSON.stringify(input)})`).toThrow(CasParseError)
    }
  })
})

describe('nerdamer adapter — symbols', () => {
  it('collects free symbols once each', () => {
    expect([...radians.freeSymbols(radians.parse('sqrt(2 * h / g)'))].sort()).toEqual(['g', 'h'])
  })

  it('does not report constants as free symbols', () => {
    expect(radians.freeSymbols(radians.parse('pi * r^2'))).toEqual(['r'])
  })

  it('reports constant expressions', () => {
    expect(radians.isConstant(radians.parse('sqrt(2)'))).toBe(true)
    expect(radians.isConstant(radians.parse('x + 1'))).toBe(false)
  })
})

describe('nerdamer adapter — solving', () => {
  it('solves a linear equation', () => {
    expect(numbers(numericRoots(radians, '2 * x + 3 - 11', 'x'))).toEqual([4])
  })

  it('solves a quadratic with two rational roots', () => {
    const values = numbers(numericRoots(radians, 'x^2 - 3 * x + 2', 'x')).sort((a, b) => a - b)
    expect(values).toEqual([1, 2])
  })

  it('evaluates irrational roots numerically', () => {
    const values = numbers(numericRoots(radians, 'x^2 - 2', 'x')).sort((a, b) => a - b)
    expect(values[0]).toBeCloseTo(-1.4142135623730951, 10)
    expect(values[1]).toBeCloseTo(1.4142135623730951, 10)
  })

  it('leaves complex roots non-numeric', () => {
    expect(numericRoots(radians, 'x^2 + 1', 'x').every((value) => value === null)).toBe(true)
  })

  it('solves a 2x2 linear system', () => {
    const system = [radians.parse('x + y - 3'), radians.parse('x - y - 1')]
    expect(radians.solveSystem(system, ['x', 'y'])).toEqual({ x: [2], y: [1] })
  })

  it('returns null for inconsistent systems', () => {
    const system = [radians.parse('x + y - 3'), radians.parse('x + y - 4')]
    expect(radians.solveSystem(system, ['x', 'y'])).toBeNull()
  })
})

describe('nerdamer adapter — substitution', () => {
  it('replaces symbols without mutating the original node', () => {
    const node = radians.parse('x^2 + y')
    const replaced = radians.substitute(node, { y: '3', x: '2' })
    expect(radians.evaluate(replaced, {})).toBe(7)
    expect(radians.freeSymbols(node).sort()).toEqual(['x', 'y'])
    expect(radians.evaluate(node, {})).toBeNull()
  })

  it('accepts expression text as a replacement', () => {
    const node = radians.substitute(radians.parse('a * b'), { a: 'x + 1', b: '2' })
    expect(radians.evaluate(node, { x: 1 })).toBe(4)
  })
})

describe('nerdamer adapter — degrees mode', () => {
  it('evaluates trigonometric functions in radians by default', () => {
    expect(radians.evaluate(radians.parse('sin(30)'), {})).toBeCloseTo(-0.9880316240928618, 10)
  })

  it('evaluates trigonometric functions in degrees when configured', () => {
    expect(degrees.evaluate(degrees.parse('sin(30)'), {})).toBeCloseTo(0.5, 10)
  })

  it('wraps argument expressions', () => {
    expect(degrees.evaluate(degrees.parse('sin(2 * 30)'), {})).toBeCloseTo(
      Math.sin(Math.PI / 3),
      10,
    )
  })

  it('wraps nested trigonometric calls', () => {
    const expected = Math.sin((Math.cos(Math.PI / 3) * Math.PI) / 180)
    expect(degrees.evaluate(degrees.parse('sin(cos(60))'), {})).toBeCloseTo(expected, 10)
  })

  it('evaluates with scope values in degrees mode', () => {
    expect(degrees.evaluate(degrees.parse('cos(x)'), { x: 60 })).toBeCloseTo(0.5, 10)
  })

  it('converts inverse trigonometric results to degrees', () => {
    expect(degrees.evaluate(degrees.parse('asin(0.5)'), {})).toBeCloseTo(30, 10)
  })

  it('keeps inverse trigonometric results in radians by default', () => {
    expect(radians.evaluate(radians.parse('asin(0.5)'), {})).toBeCloseTo(Math.PI / 6, 10)
  })
})
