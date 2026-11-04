import type { Allocation } from './investment-analytics'
import { decimalUnits, sumMoney } from './money'

/** Aggregate only values already converted by the dated backend valuation service. */
export function overviewGroups(
  rows: NonNullable<Allocation['rows']>,
  dimension: 'account_id' | 'asset_id',
) {
  const grouped = new Map<
    string,
    { id: string; name: string; values: string[]; complete: boolean }
  >()
  for (const row of rows) {
    const id = row[dimension]
    if (id === null) continue // Cash is part of account totals, never a top holding.
    const group = grouped.get(id) ?? {
      id,
      name: dimension === 'account_id' ? row.account : row.security,
      values: [],
      complete: true,
    }
    if (row.value === null) group.complete = false
    else group.values.push(row.value)
    grouped.set(id, group)
  }
  return [...grouped.values()].map((g) => ({
    id: g.id,
    name: g.name,
    value: g.complete ? sumMoney(g.values) : null,
  }))
}

export function topHoldings(rows: NonNullable<Allocation['rows']>) {
  return overviewGroups(rows, 'asset_id')
    .filter((g): g is typeof g & { value: string } => g.value !== null)
    .sort((a, b) => {
      const difference = decimalUnits(b.value) - decimalUnits(a.value)
      return difference > 0n
        ? 1
        : difference < 0n
          ? -1
          : a.id.localeCompare(b.id)
    })
    .slice(0, 5)
}
