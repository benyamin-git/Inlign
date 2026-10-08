export type LineKind = 'blank' | 'prose' | 'claim' | 'definition' | 'equation' | 'expression'

export type AngleMode = 'radians' | 'degrees'

export interface SolveSettings {
  angleMode: AngleMode
  precision: number
  toleranceOverride: number | null
}

export interface AnnotationFix {
  from: number
  to: number
  insert: string
}

export interface Annotation {
  line: number
  from: number
  to: number
  kind: 'result' | 'conflict' | 'error' | 'unresolved'
  text: string
  expected?: string
  fix?: AnnotationFix
}

export interface SolveRequest {
  version: number
  text: string
  settings: SolveSettings
}

export interface SolveResponse {
  version: number
  annotations: Annotation[]
}
