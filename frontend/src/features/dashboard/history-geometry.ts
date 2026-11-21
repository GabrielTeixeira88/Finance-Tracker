// Exact monetary strings remain authoritative; only dimensionless chart geometry uses Number.
import { decimalUnits } from '@/lib/money'
import type { HistoryPoint } from './history-chart'

/** A common decimal-power axis. Only bounded, dimensionless ratios become Number. */
export function historyGeometry(points: HistoryPoint[]) {
  const max = points
    .flatMap((p) => [p.value, p.net_contribution])
    .reduce((m, v) => {
      const units = v === null ? 0n : decimalUnits(v)
      const absolute = units < 0n ? -units : units
      return absolute > m ? absolute : m
    }, 0n)
  const scale = 10n ** BigInt(Math.max(0, max.toString().length - 1))
  const coordinate = (v: string | null) =>
    v === null
      ? null
      : Number((decimalUnits(v) * 1_000_000n) / scale) / 1_000_000
  return points.map((p) => ({
    ...p,
    totalValue: coordinate(p.value),
    netContribution: coordinate(p.net_contribution),
  }))
}
