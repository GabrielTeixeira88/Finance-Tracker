import { decimalUnits, unitsToMoney, formatExactPercent } from '@/lib/money'
export type ReturnData = { date: string; value: string | null }
export type PerformanceSeries = {
  id: string
  name: string
  returns: ReturnData[]
  isReference?: boolean
}
export function exactPercent(value: string | null | undefined) {
  return value == null ? '—' : formatExactPercent(value)
}
/** Exact percentage strings remain attached; chart coordinates alone are normalized. */
export function prepareSeries(series: PerformanceSeries[]) {
  const values = series.flatMap((s) =>
    s.returns.flatMap((p) => (p.value === null ? [] : [decimalUnits(p.value)])),
  )
  const minimum = values.reduce((a, b) => (a < b ? a : b), values[0] ?? 0n)
  const maximum = values.reduce((a, b) => (a > b ? a : b), values[0] ?? 0n)
  const keys = series.map((_, i) => 'series-' + i)
  const points = series.map(
    (s) => new Map(s.returns.map((p) => [p.date, p.value])),
  )
  const dates = [
    ...new Set(series.flatMap((s) => s.returns.map((p) => p.date))),
  ].sort()
  const rows = dates.map((date) => {
    const row: {
      date: string
      exact: Record<string, string | null>
      [key: string]: unknown
    } = { date, exact: {} }
    points.forEach((map, i) => {
      const raw = map.get(date) ?? null
      row.exact[keys[i]] = raw
      row[keys[i]] =
        raw === null
          ? null
          : minimum === maximum
            ? 0.5
            : Number(
                ((decimalUnits(raw) - minimum) * 1000000n) /
                  (maximum - minimum),
              ) / 1000000
    })
    return row
  })
  return { rows, minimum, maximum, keys }
}
export function axisPercent(
  coordinate: number,
  minimum: bigint,
  maximum: bigint,
) {
  const bounded = BigInt(Math.round(coordinate * 1000000))
  return exactPercent(
    unitsToMoney(minimum + ((maximum - minimum) * bounded) / 1000000n),
  )
}
