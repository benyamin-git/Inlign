declare const casNodeBrand: unique symbol

export interface CasNode {
  readonly [casNodeBrand]: true
}

export class CasParseError extends Error {}

export interface CasAdapter {
  parse(input: string): CasNode // throws CasParseError
  freeSymbols(node: CasNode): string[]
  isConstant(node: CasNode): boolean
  evaluate(node: CasNode, scope: Record<string, number>): number | null // null when non-numeric
  solveFor(equation: CasNode, symbol: string): CasNode[] // roots of lhs - rhs
  solveSystem(equations: CasNode[], symbols: string[]): Record<string, number[]> | null
  substitute(node: CasNode, scope: Record<string, string>): CasNode
  toString(node: CasNode): string
}
