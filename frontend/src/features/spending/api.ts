import { z } from 'zod'
import { request } from '@/lib/api'

const exact = z.string().regex(/^-?\d+(\.\d{1,6})?$/)
const totals = z.object({
  income: exact,
  expenses: exact,
  gross_expenses: exact,
  refunds: exact,
  count: z.number().int(),
  average_transaction: exact.nullable(),
})
export const spendingWorkspaceSchema = z.object({
  currency: z.string(),
  start: z.string(),
  end_exclusive: z.string(),
  as_of: z.string(),
  previous_start: z.string(),
  previous_end_exclusive: z.string(),
  current: totals.extend({
    to_savings: exact,
    from_savings: exact,
    net_saved: exact,
    net_flow: exact,
    after_savings: exact,
    change: exact,
    change_percent: exact.nullable(),
  }),
  previous: totals,
  categories: z.array(
    z.object({
      category_id: z.string().nullable(),
      name: z.string(),
      current: exact,
      previous: exact,
      change: exact,
      change_percent: exact.nullable(),
      daily_history: z
        .array(z.object({ date: z.string(), amount: exact }))
        .optional(),
      history: z.array(z.object({ month: z.string(), amount: exact })),
    }),
  ),
  daily: z.array(
    z.object({
      date: z.string(),
      income: exact,
      spending: exact,
      to_savings: exact,
      from_savings: exact,
      net_flow: exact,
      after_savings: exact,
    }),
  ),
  weekdays: z.array(z.object({ weekday: z.number().int(), amount: exact })),
  recent_daily: exact,
  other_currencies: z.array(z.string()),
  income_sources: z.array(
    z.object({
      category_id: z.string().nullable(),
      name: z.string(),
      amount: exact,
    }),
  ),
  saving_destinations: z.array(
    z.object({ account_id: z.string(), name: z.string(), amount: exact }),
  ),
})
export type SpendingWorkspaceData = z.infer<typeof spendingWorkspaceSchema>
export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  sort_order: z.number().int(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
})
export type SpendingGroup = z.infer<typeof groupSchema>
export function getSpendingWorkspace(
  start: string,
  endExclusive: string,
  asOf: string,
  currency: string,
  signal?: AbortSignal,
) {
  return request(
    '/spending/workspace?' +
      new URLSearchParams({
        date_from: start,
        date_to: endExclusive,
        as_of: asOf,
        currency,
      }),
    { signal },
  ).then((data) => spendingWorkspaceSchema.parse(data))
}
