// SPDX-License-Identifier: AGPL-3.0-only
// Category organization adapted from Wealthfolio 92b4647 Net Worth components.
// Exact values/coverage come solely from Finance Tracker; no monetary Number coercion.
import { z } from 'zod'
import { wealthSchema } from './wealth-api'
import { decimalUnits, sumMoney, unitsToMoney } from './money'

export const netWorthInsightsSchema = z.object({
  momentum: z
    .object({
      current_change: z.string().nullable(),
      prior_change: z.string().nullable(),
      beat_by: z.string().nullable(),
      prior_start: z.string(),
      bars: z.array(
        z.object({
          month: z.string(),
          value: z.string().nullable(),
          current: z.boolean(),
        }),
      ),
      method: z.string(),
    })
    .optional(),
  tracked_since: z.string().nullable().optional(),
  velocity: z.object({
    trailing_per_month: z.string().nullable().optional(),
    pace_ratio: z.string().nullable().optional(),
    available: z.boolean(),
    reasons: z.array(z.string()),
    per_month: z.string().nullable(),
    change: z.string().nullable(),
    drivers: z.array(
      z.object({ key: z.string(), value: z.string(), per_month: z.string() }),
    ),
    method: z.string().optional(),
  }),
  categories: z.array(
    z.object({ key: z.string(), change: z.string().nullable() }),
  ),
  stale: z.array(
    z.object({ id: z.string(), name: z.string(), days: z.number() }),
  ),
  unlinked_mortgages: z.array(z.string()),
})
export const netWorthViewSchema = wealthSchema.extend({
  points: z.array(
    wealthSchema.shape.points.element.extend({
      breakdown: z.record(z.string(), z.string().nullable()).optional(),
      component_values: z.record(z.string(), z.string().nullable()).optional(),
    }),
  ),
  insights: netWorthInsightsSchema.optional(),
})
export type NetWorthView = z.infer<typeof netWorthViewSchema>
export type NetWorthGroup = {
  key: string
  kind: string
  label: string
  raw: string[]
  value: string | null
  known: string
  color: string
  components: NetWorthView['components']
  change: string | null
  history: { date: string; value: string | null }[]
}
const definitions: Record<string, [string, number]> = {
  PROPERTY: ['properties', 1],
  REAL_ESTATE: ['properties', 1],
  INVESTMENT: ['investments', 2],
  CHECKING: ['cash', 3],
  SAVINGS: ['cash', 3],
  CASH: ['cash', 3],
  CREDIT_CARD: ['cash', 3],
  VEHICLE: ['vehicles', 4],
  PRECIOUS_METAL: ['precious_metals', 5],
  COLLECTIBLE: ['collectibles', 6],
}
export const percentOf = (part: string, total: string) =>
  decimalUnits(total) > 0n
    ? unitsToMoney((decimalUnits(part) * 1_000_000n) / decimalUnits(total))
    : null
export const magnitude = (value: string) =>
  unitsToMoney(
    decimalUnits(value) < 0n ? -decimalUnits(value) : decimalUnits(value),
  )

/** Source chart geometry in bounded, dimensionless decimal-scale coordinates.
 * Decimal-power scaling preserves Recharts' upstream nice-domain behavior without
 * coercing monetary values to Number. Exact strings remain the tooltip source.
 */
export function netWorthChartGeometry(
  points: { date: string; value: string | null }[],
) {
  const values = points.flatMap((p) =>
    p.value === null ? [] : [decimalUnits(p.value)],
  )
  const absolute = values.reduce((a, b) => {
    const n = b < 0n ? -b : b
    return n > a ? n : a
  }, 0n)
  const scale = 10n ** BigInt(Math.max(0, absolute.toString().length - 1))
  const coordinate = (value: bigint) =>
    Number((value * 1_000_000n) / scale) / 1_000_000
  const data = points.map((p) => ({
    ...p,
    coordinate: p.value === null ? null : coordinate(decimalUnits(p.value)),
  }))
  const min = values.reduce((a, b) => (a < b ? a : b), values[0] ?? 0n),
    max = values.reduce((a, b) => (a > b ? a : b), values[0] ?? 0n)
  const flat = min === max,
    padding = Math.max(Math.abs(coordinate(min)) * 0.02, coordinate(1_000_000n))
  return {
    data,
    flat,
    padding,
    min: coordinate(min),
    max: coordinate(max),
    crossesZero: min < 0n && max > 0n,
  }
}
export const componentKind = (c: NetWorthView['components'][number]) =>
  c.source === 'LIABILITY' ||
  (c.native_value !== null && decimalUnits(c.native_value) < 0n)
    ? 'LIABILITY'
    : 'ASSET'
export function netWorthGroups(report: NetWorthView): NetWorthGroup[] {
  const groups = new Map<string, NetWorthGroup>()
  for (const category of report.categories) {
    const [label, index] =
      category.kind === 'LIABILITY'
        ? (['liabilities', 8] as const)
        : (definitions[category.category] ?? ['other_assets', 7])
    const key =
      category.kind +
      ':' +
      (category.kind === 'LIABILITY' ? category.category : label)
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        kind: category.kind,
        label: category.kind === 'LIABILITY' ? category.category : label,
        raw: [],
        value: '0',
        known: '0',
        color:
          category.kind === 'LIABILITY'
            ? 'var(--negative)'
            : `var(--chart-${index})`,
        components: [],
        change: null,
        history: [],
      }
      groups.set(key, group)
    }
    group.raw.push(category.category)
    group.known = sumMoney([group.known, category.known_value])
    group.value =
      group.value === null || category.value === null
        ? null
        : sumMoney([group.value, category.value])
  }
  for (const group of groups.values()) {
    group.components = report.components.filter(
      (c) => group.raw.includes(c.category) && componentKind(c) === group.kind,
    )
    group.history = report.points.map((point) => {
      const parts = group.raw.map(
        (raw) => point.breakdown?.[`${group.kind}:${raw}`],
      )
      return {
        date: point.date,
        value: parts.some((v) => v === null || v === undefined)
          ? null
          : sumMoney(parts as string[]),
      }
    })
    const first = group.history[0]?.value,
      last = group.history.at(-1)?.value
    if (first != null && last != null)
      group.change = unitsToMoney(
        (decimalUnits(last) - decimalUnits(first)) *
          (group.kind === 'LIABILITY' ? -1n : 1n),
      )
  }
  // Source breakdown lists debts individually. Their histories come from the
  // same canonical daily component projection, not category totals split by guesswork.
  const rows = [...groups.values()]
  const result = report.points.every((p) => p.component_values !== undefined)
    ? [
        ...rows.filter((g) => g.kind !== 'LIABILITY'),
        ...report.components
          .filter((c) => componentKind(c) === 'LIABILITY')
          .map((c) => {
            const history = report.points.map((p) => ({
              date: p.date,
              value:
                p.component_values![c.id] === null
                  ? null
                  : decimalUnits(p.component_values![c.id] ?? '0') < 0n
                    ? magnitude(p.component_values![c.id]!)
                    : '0.000000',
            }))
            const first = history[0]?.value,
              last = history.at(-1)?.value
            return {
              key: `LIABILITY:${c.id}`,
              kind: 'LIABILITY',
              label: c.name,
              raw: [c.category],
              value: c.value === null ? null : magnitude(c.value),
              known: c.value === null ? '0' : magnitude(c.value),
              color: 'var(--negative)',
              components: [c],
              history,
              change:
                first != null && last != null
                  ? unitsToMoney(decimalUnits(first) - decimalUnits(last))
                  : null,
            }
          }),
      ]
    : rows
  return result.sort((a, b) =>
    decimalUnits(a.known) > decimalUnits(b.known)
      ? -1
      : decimalUnits(a.known) < decimalUnits(b.known)
        ? 1
        : a.key.localeCompare(b.key),
  )
}
