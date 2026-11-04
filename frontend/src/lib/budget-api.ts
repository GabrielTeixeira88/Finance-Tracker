import { z } from 'zod'
import { request, localDate } from './api'

const money = z.string().regex(/^-?\d+(\.\d+)?$/)
const totals = z.object({
  target: money,
  carryover: money,
  available: money,
  spent: money,
  remaining: money,
  percent: money.nullable(),
})
export const budgetRowSchema = totals.extend({
  category_id: z.string().nullable(),
  name: z.string(),
  target_id: z.string().nullable(),
  group_id: z.string().nullable(),
  sort_order: z.number().int(),
  active: z.boolean(),
  rollover_enabled: z.boolean(),
  override: z.boolean(),
  status: z.string(),
  previous: money,
  change: money,
  change_percent: money.nullable(),
})
export type BudgetRow = z.infer<typeof budgetRowSchema>
export const budgetSchema = z.object({
  month: z.string(),
  currency: z.string(),
  as_of: z.string(),
  date_from: z.string(),
  date_to: z.string(),
  other_currencies: z.array(z.string()),
  summary: z.object({
    target: money,
    carryover: money,
    available: money,
    income: money,
    expenses: money,
    net_flow: money,
    budgeted_spending: money,
    unbudgeted_spending: money,
    remaining: money,
    percent: money.nullable(),
    over_count: z.number().int(),
    previous: money,
    change: money,
    change_percent: money.nullable(),
  }),
  categories: z.array(budgetRowSchema),
  groups: z.array(
    totals.extend({
      id: z.string().nullable(),
      name: z.string(),
      sort_order: z.number().int(),
    }),
  ),
  trend: z.array(
    z.object({
      month: z.string(),
      income: money,
      expenses: money,
      net_flow: money,
    }),
  ),
  daily: z.array(z.object({ date: z.string(), amount: money })),
  payees: z.array(
    z.object({ id: z.string().nullable(), name: z.string(), spent: money }),
  ),
  pace: z.object({
    elapsed_days: z.number().int(),
    days_in_month: z.number().int(),
    elapsed_percent: money.nullable(),
    projection: money.nullable(),
    status: z.string(),
  }),
  narrative: z
    .object({
      changes: z.array(
        z.object({
          category_id: z.string().nullable(),
          name: z.string(),
          current: money,
          previous: money,
          change: money,
          kind: z.string(),
        }),
      ),
      previous_days: z.number(),
      previous_spending: money.optional(),
      change_percent: money.nullable().optional(),
      comparisons: z
        .array(
          z.object({
            category_id: z.string().nullable(),
            current: money,
            previous: money,
            change: money,
          }),
        )
        .optional(),
      remaining_days: z.number(),
      recent_daily: money.nullable(),
      budget_status: z.string(),
      weekdays: z.array(z.object({ weekday: z.number(), value: money })),
    })
    .optional(),
})
export type BudgetReport = z.infer<typeof budgetSchema>
export const getBudget = async (
  month: string,
  currency: string,
  signal?: AbortSignal,
) =>
  budgetSchema.parse(
    await request(
      `/budgets/monthly?${new URLSearchParams({ month, currency, as_of: localDate() })}`,
      { signal },
    ),
  )

export function shiftMonth(month: string, delta: number) {
  const [year, index] = month.split('-').map(Number)
  const day = new Date(year, index - 1 + delta, 1)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`
}
