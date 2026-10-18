import { z } from 'zod'
import { request, transactionSchema } from './api'

export const matchSchema = transactionSchema.extend({
  classification: z.string(),
  evidence: z.array(z.string()),
})
export const candidateSchema = z.object({
  id: z.string(),
  batch_id: z.string(),
  batch_status: z.string(),
  account_id: z.string(),
  source_type: z.string(),
  candidate: z.record(z.string(), z.unknown()),
  classification: z.string(),
  matches: z.array(matchSchema),
  reason: z.string(),
  transaction_id: z.string().nullable(),
  detached: z.boolean(),
  dismissed: z.boolean(),
  token: z.string(),
})
export const statementSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  currency: z.string(),
  cutoff: z.string(),
  statement_balance: z.string(),
  cleared_balance: z.string(),
  difference: z.string(),
  status: z.string(),
  revision: z.number(),
  pending_source_ids: z.array(z.string()).optional(),
  settlement_after_cutoff_ids: z.array(z.string()).optional(),
  notes: z.string(),
  token: z.string(),
  transactions: z.array(transactionSchema),
})
export type Statement = z.infer<typeof statementSchema>
export type MatchCandidate = z.infer<typeof candidateSchema>
export const getCandidates = async (offset: number) =>
  z
    .array(candidateSchema)
    .parse(await request(`/reconciliation/candidates?offset=${offset}`))
export const getStatements = async (accountId: string) =>
  z
    .array(statementSchema)
    .parse(await request(`/reconciliation/sessions?account_id=${accountId}`))
export const newCommand = (data: Record<string, unknown>) => ({
  request_id: crypto.randomUUID(),
  ...data,
})
