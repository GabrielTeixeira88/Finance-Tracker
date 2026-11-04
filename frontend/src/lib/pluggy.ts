import { z } from 'zod'
import { request } from './api'

export const pluggyKinds = [
  'ACCOUNT',
  'TRANSACTION',
  'BILL',
  'INVESTMENT',
  'INVESTMENT_TRANSACTION',
  'CONSENT',
  'LOAN',
  'IDENTITY',
] as const
export type PluggyKind = (typeof pluggyKinds)[number]
export const itemSchema = z.object({
  id: z.string(),
  external_id: z.string(),
  name: z.string(),
  status: z.string(),
  paused: z.boolean(),
  last_sync: z.string().nullable(),
  error: z.string().nullable(),
  warnings: z.array(z.object({ product: z.string(), code: z.string() })),
})
export const resourceSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  kind: z.string(),
  external_id: z.string(),
  digest: z.string(),
  data: z.record(z.string(), z.unknown()),
  account_id: z.string().nullable(),
  asset_id: z.string().nullable(),
})
export type PluggyResource = z.infer<typeof resourceSchema>
export const statusSchema = z.object({
  configured: z.boolean(),
  error: z.string().nullable(),
  automatic_posting: z.boolean(),
  payment_initiation: z.boolean(),
})
export const adoptionSchema = z.object({ id: z.string() })
export const discoverySchema = z.array(
  z.object({ external_id: z.string(), name: z.string(), status: z.string() }),
)
export async function pluggyRequest(
  path: string,
  data?: unknown,
  method = data === undefined ? 'GET' : 'POST',
) {
  return request('/pluggy' + path, {
    method,
    headers: { 'X-Finance-Pluggy': '1' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
}
export function providerText(resource: PluggyResource, key: string): string {
  const value = resource.data[key]
  return typeof value === 'string' ? value : ''
}
