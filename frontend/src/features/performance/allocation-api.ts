import { z } from 'zod'
import { request } from '@/lib/api'
const exact = z.string().regex(/^-?\d+(\.\d+)?$/)
export const targetSchema = z.object({
  target: z.object({
    id: z.string(),
    name: z.string(),
    dimension: z.string(),
    currency: z.string(),
    scope: z.enum(['all', 'accounts']),
    band_type: z.enum(['absolute', 'hybrid']),
    band_bps: z.number().int(),
    relative_factor_bps: z.number().int(),
    version: z.number().int(),
    active: z.boolean(),
  }),
  weights: z.array(
    z.object({
      category: z.string(),
      target_bps: z.number().int(),
      required: z.boolean(),
    }),
  ),
  account_ids: z.array(z.string()),
})
export type AllocationTarget = z.infer<typeof targetSchema>
export const driftSchema = z.object({
  target_id: z.string(),
  as_of: z.string(),
  currency: z.string(),
  dimension: z.string(),
  scope: z.string(),
  account_ids: z.array(z.string()),
  total_value: exact.nullable(),
  known_value: exact,
  quality: z.string(),
  out_of_band_count: z.number().nullable(),
  reasons: z.array(z.string()),
  limitations: z.array(z.string()),
  rows: z.array(
    z.object({
      category: z.string(),
      current_value: exact.nullable(),
      current_bps: exact.nullable(),
      target_bps: z.number(),
      target_value: exact.nullable(),
      drift_bps: exact.nullable(),
      value_delta: exact.nullable(),
      effective_band_bps: z.number(),
      required: z.boolean(),
      status: z.string(),
      members: z.array(
        z.object({ account_id: z.string(), asset_id: z.string().nullable() }),
      ),
    }),
  ),
})
export type Drift = z.infer<typeof driftSchema>
export const listTargets = async (signal?: AbortSignal) =>
  z
    .array(targetSchema)
    .parse(await request('/investments/allocation-targets', { signal }))
export const getDrift = async (
  id: string,
  asOf: string,
  signal?: AbortSignal,
) =>
  driftSchema.parse(
    await request(`/investments/allocation-targets/${id}/drift?as_of=${asOf}`, {
      signal,
    }),
  )
export async function writeTarget(data: unknown, id?: string) {
  return targetSchema.parse(
    await request(`/investments/allocation-targets${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    }),
  )
}
