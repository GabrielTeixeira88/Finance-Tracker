import { z } from 'zod'
import { request } from './api'

const exact = z.string().regex(/^-?\d+(\.\d+)?$/)
const contract = z.object({
  id: z.string(),
  asset_id: z.string(),
  account_id: z.string(),
  currency: z.string(),
  instrument_type: z.enum(['CDB_CDI', 'RDB_CDI', 'CDB_FIXED', 'TESOURO_SELIC']),
  issuer: z.string(),
  settlement_date: z.string(),
  maturity_date: z.string(),
  redemption_from: z.string(),
  liquidity: z.string(),
  index_name: z.string().nullable(),
  index_source: z.string(),
  cdi_percent: exact,
  annual_rate: exact,
  spread_rate: exact,
  acquisition_price: exact,
  fictional: z.boolean(),
  fgc_eligible: z.boolean(),
  notes: z.string(),
})
export const fixedPosition = z.object({
  contract,
  name: z.string(),
  quantity: exact,
  principal: exact,
  gross_value: exact.nullable(),
  gross_interest: exact.nullable(),
  income_tax: exact.nullable(),
  iof: exact.nullable(),
  tax_rate: exact.nullable(),
  estimated_net: exact.nullable(),
  realized_net: exact,
  status: z.string(),
  redemption_available: z.boolean(),
  quality: z.string(),
  valuation_source: z.string().nullable(),
  price_date: z.string().nullable(),
})
export type FixedPosition = z.infer<typeof fixedPosition>
export const fixedReport = z.object({
  as_of: z.string(),
  currency: z.string(),
  positions: z.array(fixedPosition),
})
export const fixedHistory = z.object({
  currency: z.string(),
  source: z.string(),
  fictional: z.boolean(),
  points: z.array(
    z.object({
      date: z.string(),
      principal: exact,
      value: exact.nullable(),
      gross_interest: exact.nullable(),
      estimated_net_earnings: exact.nullable().optional(),
      income_tax: exact.nullable().optional(),
      iof: exact.nullable().optional(),
      cdi_return_percent: exact.nullable(),
      contract_return_percent: exact.nullable(),
    }),
  ),
})
export type FixedHistory = z.infer<typeof fixedHistory>
export const redemptionEstimate = z.object({
  principal: exact,
  gross_value: exact,
  gross_interest: exact,
  income_tax: exact,
  iof: exact,
  fees: exact,
  cash_proceeds: exact,
})
export type RedemptionEstimate = z.infer<typeof redemptionEstimate>
export const getFixedIncome = async (
  asOf: string,
  accountId: string,
  signal?: AbortSignal,
) =>
  fixedReport.parse(
    await request(
      `/investments/fixed-income?${new URLSearchParams({ as_of: asOf, ...(accountId ? { account_id: accountId } : {}) })}`,
      { signal },
    ),
  )
export const getFixedHistory = async (
  id: string,
  start: string,
  end: string,
  signal?: AbortSignal,
) =>
  fixedHistory.parse(
    await request(
      `/investments/fixed-income/${id}/history?${new URLSearchParams({ start, end })}`,
      { signal },
    ),
  )
