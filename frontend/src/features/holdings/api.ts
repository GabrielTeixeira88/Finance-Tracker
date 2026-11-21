import { z } from 'zod'
import { request } from '@/lib/api'
import type { Holding } from './types'
import { positionSchema, observationSchema } from '@/lib/wealth-api'
const exact = z.string().regex(/^-?\d+(\.\d{1,6})?$/)
const nullable = exact.nullable()
const monetary = z.object({ local: nullable, base: nullable })
const holdingSchema = z.object({
  id: z.string(),
  holdingType: z.enum(['SECURITY', 'CASH']),
  isClosed: z.boolean(),
  quantity: exact,
  averagePrice: nullable,
  price: nullable,
  priceDate: z.string().nullable(),
  priceSource: z.string().nullable(),
  localCurrency: z.string(),
  baseCurrency: z.string(),
  accountNames: z.array(z.string()),
  accountIds: z.array(z.string()),
  instrument: z
    .object({
      id: z.string(),
      symbol: z.string(),
      name: z.string(),
      currency: z.string(),
      exchangeMic: z.string(),
      instrumentType: z.string(),
      quoteMode: z.string(),
      classifications: z.object({
        assetType: z.object({ key: z.string(), name: z.string() }),
      }),
    })
    .nullable(),
  marketValue: monetary,
  costBasis: monetary,
  realizedGain: monetary,
  unrealizedGain: monetary,
  totalGain: monetary,
  totalReturn: monetary,
  returnBasis: monetary,
  income: monetary,
  dayChange: monetary,
  dayChangePct: nullable,
  weight: nullable,
  realizedGainPct: nullable,
  unrealizedGainPct: nullable,
  totalGainPct: nullable,
  totalReturnPct: nullable,
  contractMultiplier: exact,
  contract: z
    .object({
      instrument_type: z.string(),
      maturity_date: z.string(),
      liquidity: z.string(),
      cdi_percent: exact,
      annual_rate: exact,
    })
    .nullable(),
})
export const holdingsWorkspaceSchema = z.object({
  as_of: z.string(),
  rows: z.array(holdingSchema),
  weight_scope: z.literal('ORIGINAL_CURRENCY_INCLUDING_CASH'),
})
export async function getHoldingsWorkspace(
  accountId: string,
  asOf: string,
  signal?: AbortSignal,
): Promise<{ as_of: string; rows: Holding[]; weight_scope: string }> {
  return holdingsWorkspaceSchema.parse(
    await request(
      `/investments/workspace/holdings?${new URLSearchParams({ as_of: asOf, ...(accountId ? { account_id: accountId } : {}) })}`,
      { signal },
    ),
  )
}
export const manualHoldingSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  currency: z.string(),
  marketValue: nullable,
  unrealizedGain: nullable,
  unrealizedGainPct: nullable,
  valuationDate: z.string().nullable(),
  position: positionSchema,
  observations: z.array(observationSchema),
  linkedAssetId: z.string().nullable(),
  recordedStartingBalance: nullable,
  recordedReduction: nullable,
  paidShare: nullable,
  netEquity: nullable,
})
export type ManualHolding = z.infer<typeof manualHoldingSchema>
export async function getManualHoldings(asOf: string, signal?: AbortSignal) {
  return z
    .object({ as_of: z.string(), rows: z.array(manualHoldingSchema) })
    .parse(
      await request(`/investments/workspace/manual-holdings?as_of=${asOf}`, {
        signal,
      }),
    )
}
