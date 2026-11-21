import type { SpendingWorkspaceData } from '../api'
import { decimalUnits, subtractMoney, sumMoney } from '@/lib/money'
import { exactAbs, safePercent } from '../compat'
export type PeriodState = {
  kind: 'no_activity_either_side' | 'no_prior_period' | 'valid_comparison'
}
export type ChangeDescriptor = {
  kind: 'no_activity' | 'new' | 'ended' | 'valid'
  current: string
  prior: string
  delta: string
  absDelta: string
  pct: string | null
  showPct: boolean
  shareOfMovement: number | null
}
export function headlineDescriptors(report: SpendingWorkspaceData) {
  const periodState: PeriodState = {
    kind:
      report.current.count === 0 && report.previous.count === 0
        ? 'no_activity_either_side'
        : report.previous.count === 0 &&
            decimalUnits(report.previous.expenses) === 0n
          ? 'no_prior_period'
          : 'valid_comparison',
  }
  const movement = sumMoney(
    report.categories.map((row) => exactAbs(row.change)),
  )
  const movers = report.categories
    .map((row) => {
      const current = decimalUnits(row.current),
        prior = decimalUnits(row.previous),
        delta = subtractMoney(row.current, row.previous),
        absDelta = exactAbs(delta)
      const kind: ChangeDescriptor['kind'] =
        current === 0n && prior === 0n
          ? 'no_activity'
          : prior === 0n
            ? 'new'
            : current === 0n
              ? 'ended'
              : 'valid'
      return {
        id: row.category_id ?? '__uncategorized__',
        name: row.name,
        kind,
        current: row.current,
        prior: row.previous,
        delta,
        absDelta,
        pct: row.change_percent,
        showPct:
          prior >= 50000000n &&
          decimalUnits(absDelta) * 1000n >=
            (current > prior ? current : prior) * 15n,
        shareOfMovement: safePercent(absDelta, movement),
      }
    })
    .sort((a, b) =>
      decimalUnits(a.absDelta) > decimalUnits(b.absDelta)
        ? -1
        : decimalUnits(a.absDelta) < decimalUnits(b.absDelta)
          ? 1
          : a.id.localeCompare(b.id),
    )
  return { periodState, movers }
}
