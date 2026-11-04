export const spendingRanges = ['MTD', 'LAST', '3M', '6M', 'YTD', '1Y'] as const
export type SpendingRange = (typeof spendingRanges)[number]
const dayMs = 86_400_000
export function dayAfter(day: string, count = 1) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * dayMs)
    .toISOString()
    .slice(0, 10)
}
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(`${day}T00:00:00Z`)) &&
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
  )
}
export function spendingPeriod(range: SpendingRange, asOf: string) {
  const date = new Date(`${asOf}T00:00:00Z`)
  const monthStart = asOf.slice(0, 7) + '-01'
  if (range === 'LAST')
    return {
      start: new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1),
      )
        .toISOString()
        .slice(0, 10),
      end: dayAfter(monthStart, -1),
    }
  const months =
    range === '3M' ? 2 : range === '6M' ? 5 : range === '1Y' ? 11 : 0
  return {
    start:
      range === 'YTD'
        ? asOf.slice(0, 4) + '-01-01'
        : new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1),
          )
            .toISOString()
            .slice(0, 10),
    end: asOf,
  }
}
export function previousSpendingPeriod(
  start: string,
  end: string,
  monthToDate: boolean,
) {
  if (monthToDate) {
    const date = new Date(`${start}T00:00:00Z`)
    const previousStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1),
    )
      .toISOString()
      .slice(0, 10)
    const previousLast = dayAfter(start, -1)
    const candidate = dayAfter(previousStart, Number(end.slice(8)) - 1)
    return {
      start: previousStart,
      end: candidate > previousLast ? previousLast : candidate,
    }
  }
  const days = (Date.parse(end) - Date.parse(start)) / dayMs + 1
  return { start: dayAfter(start, -days), end: dayAfter(start, -1) }
}
export function budgetMonthForPeriod(start: string, end: string, asOf: string) {
  return start.endsWith('-01') &&
    start.slice(0, 7) === end.slice(0, 7) &&
    (end === asOf || dayAfter(end).endsWith('-01'))
    ? start.slice(0, 7)
    : asOf.slice(0, 7)
}
