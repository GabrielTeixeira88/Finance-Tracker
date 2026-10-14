import { z } from 'zod'
import { request } from './api'
import { batchSchema } from './ingestion-api'

export const gmailRequest = (path: string, data?: unknown, method = 'POST') =>
  request(`/gmail${path}`, {
    method: data === undefined ? 'GET' : method,
    headers: { 'X-Finance-Gmail': '1' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
export const connectionSchema = z.object({
  status: z.string(),
  mailbox: z.string().nullable(),
  label_id: z.string().nullable(),
  account_id: z.string().nullable(),
  last_attempt: z.string().nullable(),
  last_success: z.string().nullable(),
  error: z.string().nullable(),
  backfill_start: z.string().nullable(),
  backfill_end: z.string().nullable(),
  active_run: z.string().nullable(),
  polling_minutes: z.number(),
  paused: z.boolean(),
  senders: z.array(z.string()),
  pending: z.number(),
  configured: z.boolean(),
})
export type GmailConnection = z.infer<typeof connectionSchema>
export const getGmail = async () =>
  connectionSchema.parse(await gmailRequest(''))
export const getLabels = async () =>
  z
    .array(z.object({ id: z.string(), name: z.string() }))
    .parse(await gmailRequest('/labels'))
export const getQueue = async (offset: number, completed: boolean) =>
  z
    .array(batchSchema)
    .parse(await gmailRequest(`/queue?offset=${offset}&completed=${completed}`))
export const getRuns = async () =>
  z
    .array(
      z.object({
        id: z.string(),
        status: z.string(),
        mode: z.string(),
        processed: z.number(),
        duplicates: z.number(),
        error: z.string().nullable(),
        created_at: z.string(),
      }),
    )
    .parse(await gmailRequest('/runs'))
