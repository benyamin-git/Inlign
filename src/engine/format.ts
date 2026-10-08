const NUMBER_TOKEN = /\d+(?:\.(\d+))?/g

export function lastWrittenDecimals(text: string): number {
  let places = 0
  for (const match of text.matchAll(NUMBER_TOKEN)) {
    places = match[1]?.length ?? 0
  }
  return places
}

export function writtenTolerance(rhsText: string, resolvedValue: number): number {
  const half = 0.5 * 10 ** -lastWrittenDecimals(rhsText)
  return Math.max(half, Math.abs(resolvedValue) * 1e-12)
}

export function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return String(value)
  const digits = Math.min(Math.max(Math.trunc(precision), 1), 21)
  return String(Number(value.toPrecision(digits)))
}

export function formatExpected(value: number, rhsText: string): string {
  if (!Number.isFinite(value) || Math.abs(value) >= 1e21) return formatNumber(value, 21)
  const places = Math.min(lastWrittenDecimals(rhsText) + 2, 100)
  return String(Number.parseFloat(value.toFixed(places)))
}

export function formatSolutions(values: number[], precision: number): string {
  const shown = values.slice(0, 4).map((value) => formatNumber(value, precision))
  const extra = values.length - shown.length
  const text = shown.join(' or ')
  return extra > 0 ? `${text} +${extra} more` : text
}
