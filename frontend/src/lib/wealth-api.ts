import { z } from 'zod'
import { getDemoDate, request } from './api'

function demoAsOf(path: string) {
  const day = getDemoDate()
  return day ? `${path}${path.includes('?') ? '&' : '?'}as_of=${day}` : path
}

const money = z.string()
export const positionSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['ASSET', 'LIABILITY']),
  category: z.string(),
  currency: z.string(),
  liquidity: z.string(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  acquisition_cost: money.nullable(),
  disposal_proceeds: money.nullable(),
  associated_asset_id: z.string().nullable(),
  notes: z.string(),
  terms: z.string(),
  interest_rate: money.nullable().default(null),
  minimum_payment: money.nullable().default(null),
  payment_frequency: z.string().nullable().default(null),
  expected_payoff_date: z.string().nullable().default(null),
})
export type Position = z.infer<typeof positionSchema>
export const observationSchema = z.object({
  id: z.string(),
  effective_date: z.string(),
  amount: money,
  notes: z.string(),
  voided_at: z.string().nullable(),
  void_reason: z.string().nullable(),
})
const goalSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.string(),
  mode: z.enum(['MANUAL', 'ACCOUNT']),
  target: money,
  start_date: z.string(),
  deadline: z.string().nullable(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']),
  notes: z.string(),
})
export const goalDetailSchema = z.object({
  allocations: z
    .array(z.object({ account_id: z.string(), amount: money }))
    .default([]),
  can_assign_investment: z.boolean().default(false),
  plan: z
    .object({ goal_type: z.string(), monthly: money, expected_return: money })
    .default({
      goal_type: 'custom_save_up',
      monthly: '0',
      expected_return: '0',
    }),
  deleted: z.boolean().default(false),
  lifecycle: z
    .array(
      z.object({
        effective_date: z.string(),
        status: z.string(),
        sequence: z.number(),
      }),
    )
    .default([]),
  scenario: z
    .object({
      target: money,
      deadline: z.string().nullable(),
      monthly: money,
      expected_return: money,
    })
    .optional(),
  milestone_details: z
    .array(
      z.object({
        percent: z.number(),
        amount: money,
        reached: z.boolean(),
        first_observed_date: z.string().nullable(),
        estimated_date: z.string().nullable(),
      }),
    )
    .default([]),
  goal: goalSchema,
  saved: money.nullable(),
  allocated: money,
  remaining: money.nullable(),
  warnings: z.array(z.string()),
  funding_account_id: z.string().nullable().optional(),
  funding_basis: z.string().optional(),
  entries: z.array(
    observationSchema.extend({
      account_id: z.string().nullable(),
      direction: z.string(),
    }),
  ),
  progress: money.nullable(),
  milestones: z.array(z.number()),
  required_monthly: money.nullable(),
  projected_completion: z.string().nullable(),
  overdue: z.boolean(),
  near_deadline: z.boolean().default(false),
  as_of: z.string().optional(),
  schedule_pace: z
    .object({
      status: z.enum([
        'ON_TRACK',
        'AT_RISK',
        'OFF_TRACK',
        'ACHIEVED',
        'PAUSED',
        'ARCHIVED',
        'UNAVAILABLE',
        'NO_DEADLINE',
        'NOT_STARTED',
      ]),
      required_to_date: money.nullable(),
      basis: z.string(),
    })
    .optional(),
  history: z.array(z.object({ date: z.string(), value: money.nullable() })),
  projection_method: z.string(),
  trajectory: z
    .object({
      status: z.string(),
      monthly: money,
      projected_end: money.nullable(),
      shortfall: money.nullable(),
      points: z.array(
        z.object({
          date: z.string(),
          actual: money.nullable(),
          required: money.nullable(),
          projected: money.nullable(),
        }),
      ),
    })
    .optional(),
})
export type GoalDetail = z.infer<typeof goalDetailSchema>
export const wealthSchema = z.object({
  categories: z.array(
    z.object({
      category: z.string(),
      kind: z.string(),
      value: money.nullable(),
      known_value: money,
      complete: z.boolean(),
    }),
  ),
  currency: z.string(),
  start: z.string(),
  end: z.string(),
  value: money.nullable(),
  assets: money.nullable(),
  liabilities: money.nullable(),
  known_value: money,
  complete: z.boolean(),
  change: money.nullable(),
  change_ratio: money.nullable().default(null),
  assets_change: money.nullable().default(null),
  liabilities_change: money.nullable().default(null),
  debt_to_assets: money.nullable(),
  liquid_share: money.nullable(),
  method: z.string(),
  points: z.array(
    z.object({
      date: z.string(),
      value: money.nullable(),
      known_value: money,
      complete: z.boolean(),
      assets: money.nullable().default(null),
      liabilities: money.nullable().default(null),
    }),
  ),
  components: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      source: z.string(),
      category: z.string(),
      currency: z.string(),
      native_value: money.nullable(),
      value: money.nullable(),
      liquidity: z.string(),
      missing: z.array(z.string()),
      observation_date: z.string().nullable().optional(),
    }),
  ),
})
export const getPositions = async () =>
  z.array(positionSchema).parse(await request('/manual-positions'))
export const getGoals = async () =>
  z.array(goalDetailSchema).parse(await request(demoAsOf('/goals')))
export const getGoal = async (id: string, monthly: string) =>
  goalDetailSchema.parse(
    await request(
      demoAsOf(`/goals/${id}?monthly=${encodeURIComponent(monthly)}`),
    ),
  )

export const getAllocations = async () =>
  z
    .array(
      z.object({
        account_id: z.string(),
        name: z.string(),
        currency: z.string(),
        balance: money.nullable(),
        allocated: money.nullable(),
        unallocated: money.nullable(),
        overallocated: z.boolean(),
      }),
    )
    .parse(await request(demoAsOf('/goal-allocations')))
