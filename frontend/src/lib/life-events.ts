import { z } from 'zod'
import { getDemoDate, localDate, request } from './api'
const money = z.string().regex(/^-?\d+(\.\d+)?$/)
export const lifeEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  event_type: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  currency: z.string(),
  color: z.string(),
  icon: z.string(),
  planned_budget: money.nullable(),
})
export const eventReportSchema = z.object({
  event: lifeEventSchema,
  as_of: z.string(),
  actual_cost: money.nullable(),
  known_cost: money,
  complete: z.boolean(),
  missing: z.array(z.string()),
  transaction_count: z.number(),
  linked_ids: z.array(z.string()),
  remaining: money.nullable(),
  categories: z.array(
    z.object({ id: z.string().nullable(), name: z.string(), value: money }),
  ),
  daily: z.array(z.object({ date: z.string(), value: money })),
  native_totals: z.array(z.object({ currency: z.string(), value: money })),
  transactions: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      description: z.string(),
      currency: z.string(),
      amount: money,
      value: money.nullable(),
      refund: z.boolean(),
      category_id: z.string().nullable(),
    }),
  ),
})
export type LifeEvent = z.infer<typeof lifeEventSchema>
export type EventReport = z.infer<typeof eventReportSchema>
export const getEvents = async () =>
  z
    .array(eventReportSchema)
    .parse(await request(`/life-events?as_of=${getDemoDate() || localDate()}`))
