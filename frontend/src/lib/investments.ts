import { z } from 'zod'
import { request } from './api'

const money = z.string().regex(/^-?\d+(\.\d+)?$/)
export const assetSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  exchange: z.string(),
  currency: z.string(),
  asset_type: z.string(),
  isin: z.string().nullable(),
})
export type Asset = z.infer<typeof assetSchema>
const holdingSchema = z.object({
  asset_id: z.string(),
  account_id: z.string().nullable(),
  symbol: z.string(),
  name: z.string(),
  exchange: z.string(),
  currency: z.string(),
  quantity: money,
  average_cost: money,
  cost_basis: money,
  realized: money,
  income: money,
  last_price: money.nullable(),
  price_date: z.string().nullable(),
  price_source: z.string().nullable(),
  price_stale: z.boolean(),
  price_freshness: z.string().optional(),
  market_value: money.nullable(),
  unrealized: money.nullable(),
})
export type Holding = z.infer<typeof holdingSchema>
const totalSchema = z.object({
  unrealized: money.nullable().optional(),
  currency: z.string(),
  cash: money,
  known_holdings_value: money,
  cost_basis: money,
  realized: money,
  income: money,
  missing_prices: z.number(),
  total_value: money.nullable(),
})
const accountSchema = totalSchema.extend({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  market_value: money.nullable(),
})
export const portfolioSchema = z.object({
  as_of: z.string(),
  method: z.string(),
  accounts: z.array(accountSchema),
  holdings: z.array(holdingSchema),
  positions: z.array(holdingSchema),
  totals: z.array(totalSchema),
})
export type Portfolio = z.infer<typeof portfolioSchema>
export const activitySchema = z.object({
  id: z.string(),
  request_id: z.string(),
  account_id: z.string(),
  asset_id: z.string().nullable(),
  activity_type: z.string(),
  activity_date: z.string(),
  quantity: money,
  unit_price: money,
  gross_amount: money,
  fees: money,
  taxes: money,
  cash_amount: money,
  direction: z.string(),
  currency: z.string(),
  notes: z.string(),
  voided_at: z.string().nullable(),
})
export type Activity = z.infer<typeof activitySchema>
export const getAssets = async () =>
  z.array(assetSchema).parse(await request('/investments/assets'))
export const getPortfolio = async (
  accountId: string,
  asOf: string,
  signal?: AbortSignal,
) =>
  portfolioSchema.parse(
    await request(
      `/investments/portfolio?${new URLSearchParams({ ...(accountId ? { account_id: accountId } : {}), ...(asOf ? { as_of: asOf } : {}) })}`,
      { signal },
    ),
  )
export const getActivities = async (
  accountId: string,
  assetId: string,
  offset: number,
  signal?: AbortSignal,
) =>
  z
    .array(activitySchema)
    .parse(
      await request(
        `/investments/activities?${new URLSearchParams({ offset: String(offset), limit: '50', ...(accountId ? { account_id: accountId } : {}), ...(assetId ? { asset_id: assetId } : {}) })}`,
        { signal },
      ),
    )
export const quantityText = (value: string) =>
  value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
