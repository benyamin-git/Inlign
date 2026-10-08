import { CasParseError, type CasAdapter, type CasNode } from './cas/types'

export interface Statement {
  line: number
  from: number
  to: number
  kind: 'claim' | 'definition' | 'equation' | 'expression'
  text: string
  symbol: string | null
  node: CasNode
  rhsText: string | null
  claim: boolean
}

export type Classification = { kind: 'blank' | 'prose' } | Statement

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

export function classifyLine(
  line: string,
  lineIndex: number,
  offset: number,
  cas: CasAdapter,
): Classification {
  const trimmed = line.trim()
  if (trimmed === '') return { kind: 'blank' }
  if (trimmed.startsWith('#')) return { kind: 'prose' }

  const from = offset + line.indexOf(trimmed)
  const to = from + trimmed.length

  const equals = trimmed.indexOf('=')
  if (equals === -1) {
    try {
      const node = cas.parse(trimmed)
      return {
        line: lineIndex,
        from,
        to,
        kind: 'expression',
        text: trimmed,
        symbol: null,
        node,
        rhsText: null,
        claim: false,
      }
    } catch (error) {
      if (error instanceof CasParseError) return { kind: 'prose' }
      throw error
    }
  }

  const lhs = trimmed.slice(0, equals).trim()
  const rhs = trimmed.slice(equals + 1).trim()
  if (lhs === '' || rhs === '') return { kind: 'prose' }

  try {
    const rhsNode = cas.parse(rhs)
    const node = cas.parse(`${lhs} - (${rhs})`)
    if (IDENTIFIER.test(lhs)) {
      const claim = cas.isConstant(rhsNode)
      return {
        line: lineIndex,
        from,
        to,
        kind: claim ? 'claim' : 'definition',
        text: trimmed,
        symbol: lhs,
        node,
        rhsText: rhs,
        claim,
      }
    }
    return {
      line: lineIndex,
      from,
      to,
      kind: 'equation',
      text: trimmed,
      symbol: null,
      node,
      rhsText: rhs,
      claim: false,
    }
  } catch (error) {
    if (error instanceof CasParseError) return { kind: 'prose' }
    throw error
  }
}
