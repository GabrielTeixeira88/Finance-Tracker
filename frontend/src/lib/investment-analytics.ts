import { t } from './i18n'
import { formatExactPercent } from './money'
import { z } from 'zod'
import { request } from './api'
import { fixedHistory } from './fixed-income'
import { marketHistorySchema } from './market-data'

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
  valuation: marketHistorySchema.optional(),
  net_external_flows: amount.nullable(),
  twr: metric,
  xirr: metric,
  annualized_twr: metric.nullable().optional(),
  risk: z.object({ volatility: metric, max_drawdown: metric }).optional(),
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
const reportingAmounts = z.object({
  gross: amount.nullable(),
  fees: amount.nullable(),
  taxes: amount.nullable(),
  net: amount.nullable(),
})
export const incomeReportingSchema = z.object({
  currency: z.string(),
  quality: z.enum(['COMPLETE', 'PARTIAL']),
  missing_currencies: z.array(z.string()),
  totals: reportingAmounts,
  known_net: amount,
  start: z.string(),
  end: z.string(),
  method: z.string(),
  fx_policy: z.string(),
  events: z.array(
    reportingAmounts.extend({
      id: z.string(),
      date: z.string(),
      account_id: z.string(),
      account: z.string(),
      asset_id: z.string().nullable(),
      symbol: z.string(),
      type: z.string(),
      currency: z.string(),
      original: z.object({
        currency: z.string(),
        gross: amount,
        fees: amount,
        taxes: amount,
        net: amount,
      }),
      fx: z
        .object({ date: z.string(), rate: amount, provider: z.string() })
        .nullable(),
    }),
  ),
  months: z.array(
    reportingAmounts.extend({ month: z.string(), currency: z.string() }),
  ),
  breakdowns: z.record(
    z.string(),
    z.array(
      reportingAmounts.extend({
        name: z.string(),
        id: z.string().nullable(),
        currency: z.string(),
      }),
    ),
  ),
})
export type IncomeReporting = z.infer<typeof incomeReportingSchema>
const accrualSnapshot = z.object({
  date: z.string(),
  principal: amount.nullable(),
  value: amount.nullable(),
  gross_interest: amount.nullable(),
  estimated_net_earnings: amount.nullable(),
  income_tax: amount.nullable(),
  iof: amount.nullable(),
  quality: z.string(),
})
export const accrualIncomeSchema = z.object({
  start: z.string(),
  end: z.string(),
  currency: z.string(),
  opening: accrualSnapshot,
  closing: accrualSnapshot,
  period: z.object({
    gross: amount.nullable(),
    estimated_net: amount.nullable(),
    redeemed_gross: amount,
    redeemed_net: amount,
  }),
  history: fixedHistory,
  contracts_count: z.number(),
  quality: z.string(),
  method: z.string(),
  net_policy: z.string(),
})
export async function getAccruedIncome(
  start: string,
  end: string,
  accountId: string,
  signal?: AbortSignal,
) {
  return accrualIncomeSchema.parse(
    await request(
      `/investments/analytics/income/accrual?${analyticsParams(start, end, 'BRL', accountId)}`,
      { signal },
    ),
  )
}
export const incomeSchema = z.object({
  reporting: incomeReportingSchema.nullable().optional(),
  redemptions: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        account: z.string(),
        asset_id: z.string(),
        symbol: z.string(),
        currency: z.string(),
        principal: amount,
        gross: amount,
        fees: amount,
        taxes: amount,
        net: amount,
        realized: amount,
      }),
    )
    .optional(),
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
  rows: z
    .array(
      z.object({
        asset_id: z.string().nullable(),
        account_id: z.string(),
        security: z.string(),
        account: z.string(),
        currency: z.string(),
        original_value: amount.nullable(),
        value: amount.nullable(),
        symbol: z.string().optional(),
        name: z.string().optional(),
        asset_class: z.string().optional(),
        sector: z.string().optional(),
        geography: z.string().optional(),
        instrument_type: z.string().optional(),
        issuer: z.string().optional(),
        contract_fictional: z.boolean().optional(),
        price_source: z.string().nullable().optional(),
        price_date: z.string().nullable().optional(),
        quantity: amount.optional(),
        cost_basis: amount.optional(),
        reporting_cost_basis: amount.nullable().optional(),
        reporting_unrealized: amount.nullable().optional(),
      }),
    )
    .optional(),
  currency: z.string(),
  quality: z.string(),
  reasons: z.array(z.string()),
  total_value: amount.nullable(),
  known_value: amount,
  groups: z.record(z.string(), z.array(allocationGroup)),
  concentration: z.record(z.string(), amount.nullable()),
  metadata_policy: z.string(),
  summary: z
    .object({
      cash_value: amount.nullable(),
      invested_value: amount.nullable(),
      cost_basis: amount.nullable(),
      unrealized: amount.nullable(),
      holdings_count: z.number(),
      accounts_count: z.number(),
      basis_fx_policy: z.string(),
    })
    .optional(),
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
  if (value === null) return t('common:unavailable')
  return formatExactPercent(value)
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

export const analyticsPeriods = [
  '1M',
  '3M',
  '6M',
  'YTD',
  '1Y',
  '3Y',
  'ALL',
  'Custom',
]

/** Only complete projections enter chart/summary adapters. Partial coverage is never zero-filled. */
export function reportedIncome(data: Income): Income | undefined {
  if (data.reporting?.quality !== 'COMPLETE') return undefined
  return incomeSchema.parse(data.reporting)
}
