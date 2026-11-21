// SPDX-License-Identifier: AGPL-3.0-only
// Source: Wealthfolio 92b4647 allocation-derivations / portfolio-explorer.
// Adaptation: retain authoritative API values and account/asset identities; no money Number coercion.
import type { Allocation } from './investment-analytics'
import { decimalUnits, sumMoney, unitsToMoney } from './money'

export type AllocationGroup = Allocation['groups'][string][number]
export type AllocationRow = NonNullable<Allocation['rows']>[number]
export const insightDimensions = [
  'security',
  'account',
  'asset_class',
  'sector',
  'geography',
  'instrument_type',
  'issuer',
  'currency',
] as const
export type InsightDimension = (typeof insightDimensions)[number]

export function groupRows(
  data: Allocation,
  group: AllocationGroup,
): AllocationRow[] {
  return (data.rows ?? []).filter((row) =>
    group.members.some(
      (m) => m.account_id === row.account_id && m.asset_id === row.asset_id,
    ),
  )
}

/** Percent is a decimal string; only its bounded dimensionless coordinate becomes a Number. */
export function portfolioWeight(
  value: string | null,
  data: Allocation,
): string | null {
  if (
    data.quality !== 'COMPLETE' ||
    value === null ||
    data.total_value === null ||
    decimalUnits(data.total_value) <= 0n ||
    decimalUnits(value) < 0n
  )
    return null
  return unitsToMoney(
    (decimalUnits(value) * 100_000_000n) / decimalUnits(data.total_value),
  )
}

/** Contract metadata provides a real class -> instrument drill; no fabricated ETF look-through. */
export function classChildren(
  data: Allocation,
  parent: AllocationGroup,
): AllocationGroup[] {
  const rows = groupRows(data, parent)
  if (
    !rows.length ||
    !rows.some((row) =>
      ['CDB_CDI', 'CDB_FIXED', 'RDB_CDI', 'TESOURO_SELIC'].includes(
        row.instrument_type ?? '',
      ),
    )
  )
    return []
  const buckets = new Map<string, AllocationRow[]>()
  for (const row of rows) {
    const name = row.instrument_type || 'Unknown'
    buckets.set(name, [...(buckets.get(name) ?? []), row])
  }
  return [...buckets].map(([name, members]) => {
    const value = members.some((row) => row.value === null)
      ? null
      : sumMoney(members.map((row) => row.value!))
    return {
      name,
      value,
      weight_percent: portfolioWeight(value, data),
      members: members.map(({ account_id, asset_id }) => ({
        account_id,
        asset_id,
      })),
    }
  })
}

export function summaryValues(data: Allocation) {
  const total = (invested: boolean) => {
    if (!data.rows) return null
    const rows = data.rows.filter((row) => (row.asset_id !== null) === invested)
    return rows.some((row) => row.value === null)
      ? null
      : sumMoney(rows.map((row) => row.value!))
  }
  return (
    data.summary ?? {
      cash_value: total(false),
      invested_value: total(true),
      cost_basis: null,
      unrealized: null,
      holdings_count: new Set(
        data.rows?.filter((r) => r.asset_id).map((r) => r.asset_id),
      ).size,
      accounts_count: new Set(data.rows?.map((r) => r.account_id)).size,
      basis_fx_policy: '',
    }
  )
}
