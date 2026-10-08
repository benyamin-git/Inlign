import { describe, expect, it } from 'vitest'
import { classifyLine } from './classify'
import { CasParseError, type CasAdapter, type CasNode } from './cas/types'

interface StubNode {
  text: string
  symbols: string[]
}

interface Token {
  kind: 'number' | 'identifier' | 'operator'
  text: string
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let rest = input
  while (rest.length > 0) {
    const whitespace = /^\s+/.exec(rest)
    if (whitespace) {
      rest = rest.slice(whitespace[0].length)
      continue
    }
    const number = /^\d+(?:\.\d+)?/.exec(rest)
    if (number) {
      tokens.push({ kind: 'number', text: number[0] })
      rest = rest.slice(number[0].length)
      continue
    }
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest)
    if (identifier) {
      tokens.push({ kind: 'identifier', text: identifier[0] })
      rest = rest.slice(identifier[0].length)
      continue
    }
    const operator = /^[+\-*/^%(),]/.exec(rest)
    if (operator) {
      tokens.push({ kind: 'operator', text: operator[0] })
      rest = rest.slice(operator[0].length)
      continue
    }
    throw new CasParseError(`unexpected character: ${rest[0]}`)
  }
  return tokens
}

class StubParser {
  private readonly tokens: Token[]
  private index = 0
  private readonly symbols = new Set<string>()

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): string[] {
    if (this.tokens.length === 0) throw new CasParseError('empty expression')
    this.expression()
    if (this.index < this.tokens.length) throw new CasParseError('unexpected trailing input')
    return [...this.symbols]
  }

  private peek(): Token | undefined {
    return this.tokens[this.index]
  }

  private eat(text: string): boolean {
    const token = this.peek()
    if (token?.kind === 'operator' && token.text === text) {
      this.index += 1
      return true
    }
    return false
  }

  private expect(text: string): void {
    if (!this.eat(text)) throw new CasParseError(`expected ${text}`)
  }

  private expression(): void {
    this.term()
    while (this.eat('+') || this.eat('-')) this.term()
  }

  private term(): void {
    this.factor()
    while (this.eat('*') || this.eat('/')) this.factor()
  }

  private factor(): void {
    this.unary()
    if (this.eat('^')) this.factor()
  }

  private unary(): void {
    this.eat('-')
    this.primary()
  }

  private primary(): void {
    const token = this.peek()
    if (token === undefined) throw new CasParseError('unexpected end of expression')
    if (token.kind === 'number') {
      this.index += 1
      this.eat('%')
      return
    }
    if (token.kind === 'identifier') {
      this.index += 1
      if (this.eat('(')) {
        this.arguments()
      } else {
        this.symbols.add(token.text)
      }
      return
    }
    if (token.text === '(') {
      this.index += 1
      this.expression()
      this.expect(')')
      return
    }
    throw new CasParseError(`unexpected token: ${token.text}`)
  }

  private arguments(): void {
    if (this.eat(')')) return
    this.expression()
    while (this.eat(',')) this.expression()
    this.expect(')')
  }
}

function asStubNode(node: CasNode): StubNode {
  return node as unknown as StubNode
}

function createStubCas(): CasAdapter {
  return {
    parse(input: string): CasNode {
      const symbols = new StubParser(tokenize(input)).parse()
      return { text: input, symbols } as unknown as CasNode
    },
    freeSymbols(node: CasNode): string[] {
      return [...asStubNode(node).symbols]
    },
    isConstant(node: CasNode): boolean {
      return asStubNode(node).symbols.length === 0
    },
    evaluate(): number | null {
      return null
    },
    solveFor(): CasNode[] {
      return []
    },
    solveSystem(): Record<string, number[]> | null {
      return null
    },
    substitute(node: CasNode): CasNode {
      return node
    },
    toString(node: CasNode): string {
      return asStubNode(node).text
    },
  }
}

interface StatementExpectation {
  kind: 'claim' | 'definition' | 'equation' | 'expression'
  line: number
  from: number
  to: number
  text: string
  symbol: string | null
  rhsText: string | null
  claim: boolean
  nodeSymbols: string[]
}

interface Row {
  name: string
  line: string
  lineIndex: number
  offset: number
  expected: { kind: 'blank' | 'prose' } | StatementExpectation
}

const cas = createStubCas()

const rows: Row[] = [
  {
    name: 'empty line is blank',
    line: '',
    lineIndex: 0,
    offset: 0,
    expected: { kind: 'blank' },
  },
  {
    name: 'whitespace-only line is blank',
    line: '   ',
    lineIndex: 1,
    offset: 0,
    expected: { kind: 'blank' },
  },
  {
    name: 'comment is prose',
    line: '# comment',
    lineIndex: 2,
    offset: 0,
    expected: { kind: 'prose' },
  },
  {
    name: 'indented comment is prose',
    line: '  # note',
    lineIndex: 3,
    offset: 0,
    expected: { kind: 'prose' },
  },
  {
    name: 'prose that looks like math is prose',
    line: 'the total is 5',
    lineIndex: 4,
    offset: 0,
    expected: { kind: 'prose' },
  },
  {
    name: 'unparsable line with equals is prose',
    line: 'the total = 5',
    lineIndex: 5,
    offset: 0,
    expected: { kind: 'prose' },
  },
  {
    name: 'trailing operator is prose',
    line: 'x = 2 +',
    lineIndex: 6,
    offset: 0,
    expected: { kind: 'prose' },
  },
  {
    name: 'empty right-hand side is prose',
    line: 'x = ',
    lineIndex: 7,
    offset: 0,
    expected: { kind: 'prose' },
  },
  {
    name: 'empty left-hand side is prose',
    line: ' = 5',
    lineIndex: 8,
    offset: 0,
    expected: { kind: 'prose' },
  },
  {
    name: 'integer claim keeps absolute offsets',
    line: 'x = 5',
    lineIndex: 3,
    offset: 100,
    expected: {
      kind: 'claim',
      line: 3,
      from: 100,
      to: 105,
      text: 'x = 5',
      symbol: 'x',
      rhsText: '5',
      claim: true,
      nodeSymbols: ['x'],
    },
  },
  {
    name: 'claim without spaces',
    line: 'x=5',
    lineIndex: 11,
    offset: 0,
    expected: {
      kind: 'claim',
      line: 11,
      from: 0,
      to: 3,
      text: 'x=5',
      symbol: 'x',
      rhsText: '5',
      claim: true,
      nodeSymbols: ['x'],
    },
  },
  {
    name: 'padded decimal claim keeps absolute offsets',
    line: '  g = 9.81  ',
    lineIndex: 2,
    offset: 40,
    expected: {
      kind: 'claim',
      line: 2,
      from: 42,
      to: 50,
      text: 'g = 9.81',
      symbol: 'g',
      rhsText: '9.81',
      claim: true,
      nodeSymbols: ['g'],
    },
  },
  {
    name: 'constant expression right-hand side is a claim',
    line: 'area = 3.14 * 2',
    lineIndex: 4,
    offset: 0,
    expected: {
      kind: 'claim',
      line: 4,
      from: 0,
      to: 15,
      text: 'area = 3.14 * 2',
      symbol: 'area',
      rhsText: '3.14 * 2',
      claim: true,
      nodeSymbols: ['area'],
    },
  },
  {
    name: 'definition with free symbols',
    line: 'y = x + 1',
    lineIndex: 5,
    offset: 0,
    expected: {
      kind: 'definition',
      line: 5,
      from: 0,
      to: 9,
      text: 'y = x + 1',
      symbol: 'y',
      rhsText: 'x + 1',
      claim: false,
      nodeSymbols: ['x', 'y'],
    },
  },
  {
    name: 'definition with a function call',
    line: 't = sqrt(2 * h / g)',
    lineIndex: 6,
    offset: 0,
    expected: {
      kind: 'definition',
      line: 6,
      from: 0,
      to: 19,
      text: 't = sqrt(2 * h / g)',
      symbol: 't',
      rhsText: 'sqrt(2 * h / g)',
      claim: false,
      nodeSymbols: ['g', 'h', 't'],
    },
  },
  {
    name: 'equation with a non-identifier left-hand side',
    line: '2 * x + 3 = 11',
    lineIndex: 7,
    offset: 0,
    expected: {
      kind: 'equation',
      line: 7,
      from: 0,
      to: 14,
      text: '2 * x + 3 = 11',
      symbol: null,
      rhsText: '11',
      claim: false,
      nodeSymbols: ['x'],
    },
  },
  {
    name: 'bare expression',
    line: '2 + 2',
    lineIndex: 8,
    offset: 0,
    expected: {
      kind: 'expression',
      line: 8,
      from: 0,
      to: 5,
      text: '2 + 2',
      symbol: null,
      rhsText: null,
      claim: false,
      nodeSymbols: [],
    },
  },
  {
    name: 'percent literal expression',
    line: '50%',
    lineIndex: 9,
    offset: 0,
    expected: {
      kind: 'expression',
      line: 9,
      from: 0,
      to: 3,
      text: '50%',
      symbol: null,
      rhsText: null,
      claim: false,
      nodeSymbols: [],
    },
  },
  {
    name: 'padded expression keeps absolute offsets',
    line: '  6 * 7 ',
    lineIndex: 10,
    offset: 12,
    expected: {
      kind: 'expression',
      line: 10,
      from: 14,
      to: 19,
      text: '6 * 7',
      symbol: null,
      rhsText: null,
      claim: false,
      nodeSymbols: [],
    },
  },
]

function isStatementExpectation(expected: Row['expected']): expected is StatementExpectation {
  return 'nodeSymbols' in expected
}

describe('classifyLine', () => {
  for (const row of rows) {
    it(row.name, () => {
      const result = classifyLine(row.line, row.lineIndex, row.offset, cas)
      if (!isStatementExpectation(row.expected)) {
        expect(result).toEqual({ kind: row.expected.kind })
        return
      }
      if (!('from' in result)) {
        throw new Error(`expected a statement, got ${JSON.stringify(result)}`)
      }
      const { nodeSymbols, ...fields } = row.expected
      expect(result).toMatchObject(fields)
      expect([...cas.freeSymbols(result.node)].sort()).toEqual([...nodeSymbols].sort())
    })
  }
})
