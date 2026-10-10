import { z } from 'zod'
import { request, transactionSchema } from './api'

export const conditionFields = [
  'description',
  'payee_name',
  'amount',
  'transaction_type',
  'currency',
  'account_id',
  'category_id',
  'review_status',
] as const
export type Condition = {
  field: (typeof conditionFields)[number]
  operator: string
  value: string
}
const actions = z.object({
  payee_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  review_status: z.string().nullable().optional(),
})
const ruleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  priority: z.number().int(),
  match_mode: z.enum(['ALL', 'ANY']),
  conditions: z.array(
    z.object({
      field: z.enum(conditionFields),
      operator: z.string(),
      value: z.string(),
    }),
  ),
  actions,
})
export type Rule = z.infer<typeof ruleSchema>
export type RuleDraft = Omit<Rule, 'id'>
const action = z.object({
  field: z.string(),
  before: z.string().nullable(),
  after: z.string(),
  rule_name: z.string(),
})
const previewSchema = z.object({
  match_count: z.number(),
  change_count: z.number(),
  skipped_fields: z.number(),
  preview_token: z.string(),
  rows: z.array(
    z.object({
      transaction_id: z.string(),
      description: z.string(),
      date: z.string(),
      amount: z.string(),
      currency: z.string(),
      proposed: z.array(action),
      skipped: z.array(action.extend({ reason: z.string() })),
    }),
  ),
})
export type RulePreview = z.infer<typeof previewSchema>
const suggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  conditions: ruleSchema.shape.conditions,
  actions,
  support_count: z.number(),
  status: z.enum(['PENDING', 'ACCEPTED', 'DISMISSED', 'STALE']),
})
export type Suggestion = z.infer<typeof suggestionSchema>
export const getRules = async () =>
  z.array(ruleSchema).parse(await request('/rules'))
export const getSuggestions = async () =>
  z.array(suggestionSchema).parse(await request('/rule-suggestions'))
export const previewRule = async (id: string) =>
  previewSchema.parse(await request(`/rules/${id}/preview`, { method: 'POST' }))
export const previewDraft = async (rule: RuleDraft, rule_id?: string) =>
  previewSchema.parse(
    await request('/rules/preview', {
      method: 'POST',
      body: JSON.stringify({ rule, rule_id }),
    }),
  )
export const frequencies = [
  'ONCE',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'YEARLY',
] as const
const scheduleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  transaction_type: z.enum(['INCOME', 'EXPENSE']),
  account_id: z.string(),
  currency: z.string(),
  payee_id: z.string().nullable(),
  category_id: z.string().nullable(),
  amount: z.string(),
  amount_is_approximate: z.boolean(),
  amount_tolerance: z.string(),
  frequency: z.enum(frequencies),
  start_date: z.string(),
  end_date: z.string().nullable(),
  enabled: z.boolean(),
  next_due_date: z.string().nullable(),
})
export type Schedule = z.infer<typeof scheduleSchema>
const occurrenceSchema = z.object({
  schedule_id: z.string(),
  name: z.string(),
  due_date: z.string(),
  amount: z.string(),
  currency: z.string(),
  transaction_type: z.string(),
  account_id: z.string(),
  payee_id: z.string().nullable(),
  category_id: z.string().nullable(),
  frequency: z.string(),
  amount_is_approximate: z.boolean(),
  status: z.enum(['UPCOMING', 'DUE', 'OVERDUE', 'COMPLETED']),
  transaction_id: z.string().nullable(),
})
export type Occurrence = z.infer<typeof occurrenceSchema>
const upcomingSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  as_of: z.string(),
  occurrences: z.array(occurrenceSchema),
  totals: z.array(
    z.object({
      currency: z.string(),
      income: z.string(),
      expenses: z.string(),
      net: z.string(),
    }),
  ),
})
export const getSchedules = async () =>
  z.array(scheduleSchema).parse(await request('/schedules'))
export const getUpcoming = async (start: string, end: string, asOf: string) =>
  upcomingSchema.parse(
    await request(
      `/schedules/upcoming?date_from=${start}&date_to=${end}&as_of=${asOf}`,
    ),
  )
export const occurrencePath = (row: Occurrence) =>
  `/schedules/${row.schedule_id}/occurrences/${row.due_date}`
export const getCandidates = async (row: Occurrence) =>
  z
    .object({
      candidates: z.array(transactionSchema),
      ambiguous: z.boolean(),
      date_tolerance_days: z.number(),
      amount_tolerance: z.string(),
    })
    .parse(await request(`${occurrencePath(row)}/candidates`))
