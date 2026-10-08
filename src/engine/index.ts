import { buildAnnotations } from './annotate'
import { createCasAdapter } from './cas/nerdamer'
import { checkClaims } from './check'
import { classifyLine, type Statement } from './classify'
import { buildSystem } from './constraints'
import { resolveSystem } from './resolve'
import type { Annotation, SolveSettings } from './types'

export function solveDocument(text: string, settings: SolveSettings): Annotation[] {
  const cas = createCasAdapter(settings.angleMode)
  const statements: Statement[] = []
  let offset = 0
  for (const [index, line] of text.split('\n').entries()) {
    const classification = classifyLine(line, index, offset, cas)
    if ('line' in classification) statements.push(classification)
    offset += line.length + 1
  }
  const system = buildSystem(statements)
  const scope = resolveSystem(system, cas, settings)
  const claimAnnotations = checkClaims(system, scope, cas, settings)
  return buildAnnotations(system, scope, claimAnnotations, cas, settings)
}
