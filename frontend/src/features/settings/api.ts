import { z } from 'zod'
import { request } from '@/lib/api'

export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  account_ids: z.array(z.string()),
})
export type AccountGroup = z.infer<typeof groupSchema>
export const getGroups = async () =>
  z.array(groupSchema).parse(await request('/settings/account-groups'))
const fxSchema = z.object({
  total: z.number(),
  items: z.array(
    z.object({
      id: z.string(),
      base_currency: z.string(),
      quote_currency: z.string(),
      rate_date: z.string(),
      rate: z.string(),
      provider: z.string(),
      fetched_at: z.string(),
    }),
  ),
})
export const getFX = async (offset: number) =>
  fxSchema.parse(await request(`/settings/fx?offset=${offset}&limit=30`))
export const getAbout = async () =>
  z
    .object({
      name: z.string(),
      version: z.string(),
      database: z.string(),
      repository: z.string(),
      license: z.string(),
      deployment: z.string(),
    })
    .parse(await request('/settings/about'))
export const getExports = async () =>
  z
    .object({
      datasets: z.array(z.string()),
      formats: z.array(z.string()),
      max_rows: z.number(),
    })
    .parse(await request('/settings/exports'))
export const backupSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/),
  bytes: z.number(),
  created_at: z.string(),
})
export const getBackups = async () =>
  z
    .object({
      maintenance: z.boolean(),
      max_bytes: z.number(),
      items: z.array(backupSchema),
    })
    .parse(
      await request('/settings/backups', {
        headers: { 'X-Finance-Admin': '1' },
      }),
    )
export async function downloadFile(
  path: string,
  filename: string,
  admin = false,
) {
  const response = await fetch(`/api${path}`, {
    headers: admin ? { 'X-Finance-Admin': '1' } : {},
  })
  if (!response.ok) throw new Error(`Download failed (${response.status})`)
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
