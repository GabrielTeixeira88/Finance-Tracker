import { z } from 'zod'

export const accountTypes = [
  'CHECKING',
  'SAVINGS',
  'CASH',
  'CREDIT_CARD',
  'INVESTMENT',
] as const
export const transactionTypes = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'OPENING_BALANCE',
] as const
export const moneyInput = z
  .string()
  .regex(/^\d{1,18}(\.\d{1,6})?$/, 'Use up to 18 whole digits and 6 decimals.')
  .refine((value) => /[1-9]/.test(value), 'Amount must be greater than zero.')
export const openingInput = z
  .string()
  .regex(/^\d{1,18}(\.\d{1,6})?$/, 'Use zero or a positive decimal amount.')
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/)
const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(accountTypes),
  currency: z.string(),
  institution: z.string().nullable(),
  active: z.boolean(),
  balance: decimal,
})
const categorySchema = z.object({ id: z.string(), name: z.string() })
const transactionSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  transaction_type: z.enum(transactionTypes),
  direction: z.enum(['IN', 'OUT']),
  amount: decimal,
  currency: z.string(),
  transaction_date: z.string(),
  description: z.string(),
  merchant: z.string().nullable(),
  category_id: z.string().nullable(),
  transfer_id: z.string().nullable(),
  deleted_at: z.string().nullable(),
})
const dashboardSchema = z.object({
  month: z.string(),
  totals: z.array(
    z.object({
      currency: z.string(),
      total_balance: decimal,
      income: decimal,
      expenses: decimal,
    }),
  ),
  accounts: z.array(accountSchema),
  recent_transactions: z.array(transactionSchema),
})
export type Account = z.infer<typeof accountSchema>
export type Category = z.infer<typeof categorySchema>
export type Transaction = z.infer<typeof transactionSchema>

export const periods = ['1M', '3M', 'YTD', '1Y', 'ALL'] as const
export type Period = (typeof periods)[number]
const pointSchema = z.object({ date: z.string(), balance: decimal })
const historySchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  series: z.array(
    z.object({
      currency: z.string(),
      opening_balance: decimal,
      total_balance: decimal,
      income: decimal,
      expenses: decimal,
      net_flow: decimal,
      change: decimal,
      change_percent: decimal.nullable(),
      points: z.array(pointSchema),
      spending: z.array(
        z.object({
          category_id: z.string().nullable(),
          name: z.string(),
          amount: decimal,
        }),
      ),
    }),
  ),
  accounts: z.array(accountSchema),
  recent_transactions: z.array(transactionSchema),
})
const demoSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    version: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    preview: z.object({
      currency: z.string(),
      budgets: z.array(
        z.object({
          category_id: z.string(),
          name: z.string(),
          target: decimal,
        }),
      ),
      holdings: z.array(
        z.object({ symbol: z.string(), name: z.string(), value: decimal }),
      ),
      performance: z.array(pointSchema),
      activity: z.array(
        z.object({
          date: z.string(),
          description: z.string(),
          amount: decimal,
        }),
      ),
    }),
  }),
])
export type History = z.infer<typeof historySchema>
export type HistorySeries = History['series'][number]
export type Demo = z.infer<typeof demoSchema>
export const getHistory = async (
  period: Period,
  end: string,
  signal?: AbortSignal,
) =>
  historySchema.parse(
    await request(`/history?period=${period}&end=${end}`, { signal }),
  )
export const getDemo = async (signal?: AbortSignal) =>
  demoSchema.parse(await request('/demo', { signal }))

export async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      typeof body.detail === 'string'
        ? body.detail
        : 'Check the submitted fields and try again.',
    )
  }
  return response.status === 204 ? null : response.json()
}
export const getAccounts = async (signal?: AbortSignal) =>
  z.array(accountSchema).parse(await request('/accounts', { signal }))
export const getCategories = async (signal?: AbortSignal) =>
  z.array(categorySchema).parse(await request('/categories', { signal }))
export const getTransactions = async (
  params: URLSearchParams,
  signal?: AbortSignal,
) =>
  z
    .array(transactionSchema)
    .parse(await request(`/transactions?${params}`, { signal }))
export const getDashboard = async (month: string, signal?: AbortSignal) =>
  dashboardSchema.parse(await request(`/dashboard?month=${month}`, { signal }))

export { formatMoney } from './money'
export function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export function label(value: string) {
  return value.toLowerCase().replaceAll('_', ' ')
}
