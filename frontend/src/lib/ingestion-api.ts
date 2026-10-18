import { z } from 'zod'
import { request } from './api'

export const csvConfiguration = z.object({
  delimiter: z.enum([',', ';']),
  encoding: z.enum(['utf-8-sig', 'cp1252']),
  has_header: z.boolean(),
  date_format: z.enum(['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y']),
  decimal_separator: z.enum(['.', ',']),
  thousands_separator: z.enum(['', '.', ',']),
  amount_mode: z.enum(['signed', 'reversed', 'type', 'debit_credit']),
  columns: z.record(z.string(), z.number().int().min(0).max(99)),
  source_namespace: z.string(),
})
export type CSVConfiguration = z.infer<typeof csvConfiguration>
export const defaultConfiguration: CSVConfiguration = {
  delimiter: ',',
  encoding: 'utf-8-sig',
  has_header: true,
  date_format: '%Y-%m-%d',
  decimal_separator: '.',
  thousands_separator: '',
  amount_mode: 'signed',
  columns: { date: 0, description: 1, amount: 2 },
  source_namespace: '',
}
const candidate = z.object({
  transaction_date: z.string(),
  description: z.string(),
  amount: z.string(),
  currency: z.string(),
  transaction_type: z.enum(['INCOME', 'EXPENSE']),
  payee_id: z.string().nullable(),
  category_id: z.string().nullable(),
  review_status: z.string(),
  payee_name: z.string().nullable().optional(),
  ambiguity: z.string().nullable(),
})
const decision = z.object({
  action: z.enum(['NEW', 'SKIP', 'LINK']).optional(),
  transaction_id: z.string().nullable().optional(),
  payee_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  review_status: z.string().optional(),
  acknowledge_classification: z.boolean().optional(),
  schedule_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
})
export type ImportDecision = z.infer<typeof decision>
const sourceContext = z.object({
  warnings: z.array(z.string()),
  account_hint: z.string().optional(),
  institution: z.string().optional(),
})
const batchInfo = z.object({
  id: z.string(),
  filename: z.string(),
  source_type: z.string(),
  account_id: z.string(),
  status: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  counts: z.record(z.string(), z.number()),
  source_context: sourceContext,
})
const importRow = z.object({
  id: z.string(),
  row_number: z.number(),
  raw: z.record(z.string(), z.string()),
  candidate: candidate.nullable(),
  status: z.string(),
  errors: z.array(z.string()),
  decision,
  reason: z.string(),
  transaction_id: z.string().nullable().optional(),
  matches: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      amount: z.string().optional(),
      currency: z.string().optional(),
      transaction_date: z.string().optional(),
      evidence: z.array(z.string()).optional(),
      classification: z.string().optional(),
    }),
  ),
  schedules: z.array(
    z.object({
      schedule_id: z.string(),
      name: z.string(),
      due_date: z.string(),
      status: z.string(),
      transaction_id: z.string().nullable(),
    }),
  ),
  rules: z.array(
    z.object({
      field: z.string(),
      after: z.string().nullable(),
      rule_name: z.string(),
    }),
  ),
})
export const batchSchema = batchInfo.extend({
  rows: z.array(importRow),
  preview_token: z.string().nullable(),
  ready: z.boolean(),
  incoming: z.string(),
  outgoing: z.string(),
})
export type ImportBatch = z.infer<typeof batchSchema>
export type ImportRow = z.infer<typeof importRow>
const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  configuration: csvConfiguration,
  default_account_id: z.string().nullable(),
})
export const getProfiles = async () =>
  z.array(profileSchema).parse(await request('/imports/profiles'))
export const getImports = async (offset: number) =>
  z.array(batchInfo).parse(await request(`/imports?offset=${offset}`))
export const getImport = async (id: string) =>
  batchSchema.parse(await request(`/imports/${id}`))
export async function fileContent(file: File): Promise<string> {
  if (
    !/\.(csv|ofx)$/i.test(file.name) ||
    !file.size ||
    file.size > 2 * 1024 * 1024
  )
    throw new Error('Choose a nonempty CSV/OFX file of at most 2 MiB.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Unable to read the local file.'))
    reader.readAsDataURL(file)
  })
}
