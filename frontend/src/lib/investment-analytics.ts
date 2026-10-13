import { z } from 'zod'
import { request } from './api'

const amount = z.string().regex(/^-?\d+(\.\d+)?$/)
const metric = z.object({
  value: amount.nullable(),
  method: z.string(),
  quality: z.enum(['COMPLETE', 'PARTIAL', 'UNAVAILABLE']),
  reasons: z.array(z.string()),
})
const point = z.object({ date: z.string(), return_percent: amount.nullable() })
export const performanceSchema = z.object({
  start: z.string(),
  end: z.string(),
  currency: z.string(),
  opening_value: amount.nullable(),
  ending_value: amount.nullable(),
  net_external_flows: amount.nullable(),
  twr: metric,
  xirr: metric,
  absolute_gain: metric,
  points: z.array(point),
  benchmark: z
    .object({
      symbol: z.string(),
      method: z.string(),
      missing_days: z.number().optional(),
      source: z.string().nullable().optional(),
      quote_date: z.string().nullable().optional(),
      refreshed_at: z.string().nullable().optional(),
      points: z.array(point),
      return: metric,
      difference_percentage_points: amount.nullable(),
    })
    .nullable(),
  flows: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      type: z.string(),
      currency: z.string(),
      amount,
      reporting_amount: amount.nullable(),
      reason: z.string().nullable(),
    }),
  ),
})
export const incomeSchema = z.object({
  breakdowns: z.record(
    z.string(),
    z.array(
      z.object({
        name: z.string(),
        id: z.string().nullable(),
        currency: z.string(),
        gross: amount,
        fees: amount,
        taxes: amount,
        net: amount,
      }),
    ),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      account_id: z.string(),
      account: z.string(),
      asset_id: z.string().nullable(),
      symbol: z.string(),
      type: z.string(),
      currency: z.string(),
      gross: amount,
      fees: amount,
      taxes: amount,
      net: amount,
    }),
  ),
  months: z.array(
    z.object({
      currency: z.string(),
      month: z.string(),
      gross: amount,
      fees: amount,
      taxes: amount,
      net: amount,
    }),
  ),
})
const allocationGroup = z.object({
  name: z.string(),
  value: amount.nullable(),
  weight_percent: amount.nullable(),
  members: z.array(
    z.object({ account_id: z.string(), asset_id: z.string().nullable() }),
  ),
})
export const allocationSchema = z.object({
  currency: z.string(),
  quality: z.string(),
  reasons: z.array(z.string()),
  total_value: amount.nullable(),
  known_value: amount,
  groups: z.record(z.string(), z.array(allocationGroup)),
  concentration: z.record(z.string(), amount.nullable()),
  metadata_policy: z.string(),
})
export const insightsSchema = z.object({
  activity_trends: z
    .array(z.object({ month: z.string(), type: z.string(), count: z.number() }))
    .default([]),
  warning: z.string(),
  currency: z.string(),
  positions: z.array(
    z.object({
      account_id: z.string(),
      account: z.string().optional(),
      asset_id: z.string().nullable(),
      symbol: z.string(),
      currency: z.string(),
      quantity: amount,
      cost_basis: amount,
      average_cost: amount,
      market_value: amount.nullable(),
      realized: amount,
      unrealized: amount.nullable(),
      unrealized_change: amount.nullable(),
      income: amount,
      fees: amount,
      taxes: amount,
      standalone_charges: amount,
      total_gain: amount.nullable(),
      fx_contribution: metric.extend({ local_price_effect: amount.optional() }),
    }),
  ),
})
export type Performance = z.infer<typeof performanceSchema>
export type Income = z.infer<typeof incomeSchema>
export type Allocation = z.infer<typeof allocationSchema>
export type Insights = z.infer<typeof insightsSchema>
export const classificationSchema = z.object({
  sector: z.string().nullable(),
  geography: z.string().nullable(),
})

export function analyticsParams(
  start: string,
  end: string,
  currency: string,
  accountId: string,
  benchmarkId = '',
) {
  const params = new URLSearchParams({ start, end, as_of: end, currency })
  if (!start) params.delete('start')
  if (accountId) params.set('account_ids', accountId)
  if (benchmarkId) params.set('benchmark_id', benchmarkId)
  return params.toString()
}
export async function getPerformance(params: string, signal?: AbortSignal) {
  return performanceSchema.parse(
    await request(`/investments/analytics/performance?${params}`, { signal }),
  )
}
export async function getIncome(params: string, signal?: AbortSignal) {
  return incomeSchema.parse(
    await request(`/investments/analytics/income?${params}`, { signal }),
  )
}
export async function getAllocation(params: string, signal?: AbortSignal) {
  return allocationSchema.parse(
    await request(`/investments/analytics/allocation?${params}`, { signal }),
  )
}
export async function getInsights(params: string, signal?: AbortSignal) {
  return insightsSchema.parse(
    await request(`/investments/analytics/insights?${params}`, { signal }),
  )
}

export function percent(value: string | null) {
  if (value === null) return 'Unavailable'
  // Intl consumes the exact decimal string; this cast bridges its older TS signature.
  const format = new Intl.NumberFormat(navigator.language, {
    maximumFractionDigits: 2,
  }).format as unknown as (value: string) => string
  return `${format(value)}%`
}

export function startDate(period: string, end: string, custom: string) {
  if (period === 'Custom') return custom
  const d = new Date(`${end}T12:00:00Z`)
  if (!Number.isFinite(d.getTime())) return end
  if (period === 'YTD') return `${d.getUTCFullYear() - 1}-12-31`
  // Clamp month ends (March 31 -> February 28), rather than rolling into March.
  // ALL performance omits start; ten years bounds the accompanying detail queries.
  const day = d.getUTCDate()
  const months =
    period === 'ALL' ? 120 : parseInt(period) * (period.endsWith('Y') ? 12 : 1)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - months)
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d.toISOString().slice(0, 10)
}
