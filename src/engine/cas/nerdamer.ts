import nerdamer from 'nerdamer'
import type { AngleMode } from '../types'
import { CasParseError, type CasAdapter, type CasNode } from './types'

type NerdamerExpression = InstanceType<typeof nerdamer.classes.Expression>
type NerdamerEntity = ReturnType<typeof nerdamer>

interface NerdamerNode {
  expr: NerdamerExpression
}

const ExpressionClass = nerdamer.classes.Expression
const DictionaryClass = nerdamer.classes.Dictionary

const DIRECT_TRIG = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot'])
const INVERSE_TRIG = new Set(['asin', 'acos', 'atan', 'asec', 'acsc', 'acot', 'atan2'])

function asNode(node: CasNode): NerdamerNode {
  return node as unknown as NerdamerNode
}

function toNode(expr: NerdamerExpression): CasNode {
  return { expr } as unknown as CasNode
}

function toNumber(entity: NerdamerEntity): number | null {
  if (!(entity instanceof ExpressionClass)) return null
  if (!entity.isNumber()) return null
  try {
    const value = entity.valueOf()
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function parseText(input: string): NerdamerExpression {
  let entity: NerdamerEntity
  try {
    entity = nerdamer(input)
  } catch (error) {
    throw new CasParseError(error instanceof Error ? error.message : String(error))
  }
  if (!(entity instanceof ExpressionClass)) {
    throw new CasParseError(`not a scalar expression: ${input}`)
  }
  return entity
}

function matchingParen(text: string, open: number): number {
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    const char = text[index]
    if (char === '(') depth += 1
    if (char === ')') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

function wrapTrigDegrees(text: string): string {
  let result = ''
  let index = 0
  while (index < text.length) {
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(index))
    if (identifier) {
      const name = identifier[0]
      let open = index + name.length
      while (text[open] === ' ') open += 1
      if (text[open] === '(' && (DIRECT_TRIG.has(name) || INVERSE_TRIG.has(name))) {
        const close = matchingParen(text, open)
        if (close !== -1) {
          const inner = wrapTrigDegrees(text.slice(open + 1, close))
          result += DIRECT_TRIG.has(name)
            ? `${name}(pi/180*(${inner}))`
            : `180/pi*(${name}(${inner}))`
          index = close + 1
          continue
        }
      }
      result += name
      index += name.length
      continue
    }
    result += text[index] ?? ''
    index += 1
  }
  return result
}

export function createCasAdapter(angleMode: AngleMode = 'radians'): CasAdapter {
  // Degrees mode rewrites trig calls in the input before parsing, so evaluation,
  // substitution and solving all operate on degree-corrected arguments. As a
  // consequence, canonical text (toString) shows the wrapper in degrees mode.
  const prepare = (input: string): string =>
    angleMode === 'degrees' ? wrapTrigDegrees(input) : input

  return {
    parse(input: string): CasNode {
      return toNode(parseText(prepare(input)))
    },
    freeSymbols(node: CasNode): string[] {
      return asNode(node).expr.variables()
    },
    isConstant(node: CasNode): boolean {
      return asNode(node).expr.isConstant()
    },
    evaluate(node: CasNode, scope: Record<string, number>): number | null {
      const expr = asNode(node).expr
      try {
        return toNumber(expr.evaluate(scope))
      } catch {
        return null
      }
    },
    solveFor(equation: CasNode, symbol: string): CasNode[] {
      try {
        return asNode(equation)
          .expr.solveFor(symbol)
          .toArray()
          .map((root) => toNode(root))
      } catch {
        return []
      }
    },
    solveSystem(equations: CasNode[], symbols: string[]): Record<string, number[]> | null {
      try {
        const result = nerdamer.solveSystem(
          equations.map((equation) => asNode(equation).expr),
          symbols,
        )
        const entries = result.elements
        if (entries.length === 0) return null
        const values: Record<string, number[]> = {}
        for (const symbol of symbols) values[symbol] = []
        for (const entry of entries) {
          if (!(entry instanceof DictionaryClass)) return null
          for (const symbol of symbols) {
            const member = entry.get(symbol)
            const numeric = member === undefined ? null : toNumber(member)
            if (numeric === null) return null
            values[symbol]?.push(numeric)
          }
        }
        return values
      } catch {
        return null
      }
    },
    substitute(node: CasNode, scope: Record<string, string>): CasNode {
      let expr = asNode(node).expr
      for (const [name, value] of Object.entries(scope)) {
        expr = expr.subst(name, value)
      }
      return toNode(expr)
    },
    toString(node: CasNode): string {
      return asNode(node).expr.text()
    },
  }
}
