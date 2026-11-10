// SPDX-License-Identifier: AGPL-3.0-only
// Interval semantics adapted from Wealthfolio 92b4647
// packages/ui/src/components/financial/interval-selector.tsx.
// Native UTC date-only arithmetic replaces date-fns; the local API keeps its ten-year bound.
export function netWorthStart(period: string, end: string, custom: string) {
  if (period === 'Custom') return custom
  const value = new Date(`${end}T12:00:00Z`)
  if (!Number.isFinite(value.getTime())) return end // Let the API report invalid URL dates.
  if (period === '1D' || period === '1W')
    value.setUTCDate(value.getUTCDate() - (period === '1D' ? 1 : 7))
  else if (period === 'YTD') value.setUTCMonth(0, 1)
  else {
    const months: Record<string, number> = {
      '1M': 1,
      '3M': 3,
      '6M': 6,
      '1Y': 12,
      '3Y': 36,
      '5Y': 60,
      ALL: 120,
    }
    const day = value.getUTCDate()
    value.setUTCDate(1)
    value.setUTCMonth(value.getUTCMonth() - (months[period] ?? 12))
    const last = new Date(value)
    last.setUTCMonth(last.getUTCMonth() + 1, 0)
    value.setUTCDate(Math.min(day, last.getUTCDate()))
  }
  return value.getUTCFullYear() < 2
    ? '0002-01-01'
    : value.toISOString().slice(0, 10)
}
