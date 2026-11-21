import { z } from 'zod'
import { request } from '@/lib/api'
import { performanceSchema } from '@/lib/investment-analytics'

export const dashboardSchema = z.object({
  performance: performanceSchema,
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      currency: z.string(),
      active: z.boolean(),
      value: z.string().nullable(),
      gain: performanceSchema.shape.absolute_gain,
      twr: performanceSchema.shape.twr,
    }),
  ),
  points: z.array(
    z.object({
      date: z.string(),
      value: z.string().nullable(),
      net_contribution: z.string().nullable(),
    }),
  ),
  contribution_method: z.string(),
})
export type Dashboard = z.infer<typeof dashboardSchema>
export async function getDashboard(
  start: string | null,
  end: string,
  account: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ end })
  if (start) params.set('start', start)
  if (account) params.set('account_ids', account)
  return dashboardSchema.parse(
    await request(`/investments/analytics/dashboard?${params}`, { signal }),
  )
}
