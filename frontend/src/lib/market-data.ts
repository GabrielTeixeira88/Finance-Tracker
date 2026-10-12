import { z } from 'zod'
import { request } from './api'

const money = z.string().regex(/^-?\d+(\.\d+)?$/)
export const marketSettingsSchema = z.object({
  automatic: z.boolean(),
  reporting_currency: z.string(),
  fx_provider: z.string(),
})
const syncSchema = z.object({
  symbol: z.string().optional(),
  scope: z.string(),
  provider: z.string(),
  error: z.string().nullable(),
  attempted_at: z.string().nullable(),
  succeeded_at: z.string().nullable(),
  retry_at: z.string().nullable(),
  first_date: z.string().nullable(),
  last_date: z.string().nullable(),
})
export const marketStatusSchema = z.object({
  settings: marketSettingsSchema,
  running: z.boolean(),
  interval_minutes: z.number(),
  providers: z.array(
    z.object({ id: z.string(), configured: z.boolean(), detail: z.string() }),
  ),
  sync: z.array(syncSchema),
})
export const assetMarketSchema = z.object({
  current: z
    .object({
      price: money,
      currency: z.string(),
      price_date: z.string(),
      source: z.string(),
      fetched_at: z.string().nullable(),
    })
    .nullable()
    .optional(),
  pricing: z.object({
    mode: z.enum(['AUTOMATIC', 'MANUAL']),
    provider: z.string().nullable(),
    symbol_override: z.string().nullable(),
    blocked_from: z.string().nullable(),
    blocked_to: z.string().nullable(),
  }),
  mapping: z
    .object({
      provider: z.string(),
      symbol: z.string(),
      currency: z.string(),
      exchange: z.string(),
    })
    .nullable(),
  mapping_error: z.string().nullable(),
  sync: syncSchema.nullable(),
  observations: z.array(
    z.object({
      id: z.string(),
      price_date: z.string(),
      price: money,
      currency: z.string(),
      source: z.string(),
      price_type: z.string(),
      fetched_at: z.string().nullable(),
    }),
  ),
})
export const marketHistorySchema = z.object({
  currency: z.string(),
  warning: z.string(),
  fx_provider: z.string(),
  points: z.array(
    z.object({
      date: z.string(),
      value: money.nullable(),
      known_value: money,
      missing_assets: z.array(z.string()),
      missing_fx: z.array(z.string()),
    }),
  ),
})
export type MarketHistory = z.infer<typeof marketHistorySchema>
export const syncResultSchema = z.object({
  results: z.array(
    z.object({
      asset_id: z.string().nullable(),
      status: z.string(),
      observations: z.number(),
    }),
  ),
})
export const getSecurityHistory = async (
  id: string,
  end: string,
  signal?: AbortSignal,
) =>
  marketHistorySchema.parse(
    await request(`/market-data/assets/${id}/history?end=${end}`, { signal }),
  )
export const reportingSchema = z.object({
  reporting: z.object({
    currency: z.string(),
    known_value: money,
    total_value: money.nullable(),
    missing_prices: z.number(),
    missing_fx: z.array(z.string()),
  }),
})
export const getMarketStatus = async () =>
  marketStatusSchema.parse(await request('/market-data/status'))
export const getAssetMarket = async (id: string, offset: number, asOf = '') =>
  assetMarketSchema.parse(
    await request(
      `/market-data/assets/${id}?${new URLSearchParams({ offset: String(offset), ...(asOf ? { as_of: asOf } : {}) })}`,
    ),
  )
export const getMarketHistory = async (
  params: URLSearchParams,
  signal?: AbortSignal,
) =>
  marketHistorySchema.parse(
    await request(`/market-data/history?${params}`, { signal }),
  )
export const getReportingValue = async (
  params: URLSearchParams,
  signal?: AbortSignal,
) =>
  reportingSchema.parse(
    await request(`/market-data/valuation?${params}`, { signal }),
  )
