import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request, type Transaction } from '@/lib/api'
import { useWrite } from '@/lib/use-write'
import { newCommand } from '@/lib/reconciliation-api'
import { Field } from './forms'
import { Button } from './ui/button'
import { ErrorState, LoadingState } from './primitives'

export function TransactionSources({
  row,
  onClose,
}: {
  row: Transaction
  onClose: () => void
}) {
  const [sourceId, setSourceId] = useState('')
  const [bankDate, setBankDate] = useState(row.transaction_date)
  const mutation = useWrite()
  const data = useQuery({
    queryKey: ['transaction-sources', row.id],
    queryFn: async () =>
      z
        .object({
          clearing_status: z.string(),
          statement_ids: z.array(z.string()),
          sources: z.array(
            z.object({
              id: z.string(),
              source_type: z.string(),
              detached: z.boolean(),
              raw: z.record(z.string(), z.string()),
              candidate: z.record(z.string(), z.unknown()),
            }),
          ),
        })
        .parse(await request(`/transactions/${row.id}/sources`)),
  })
  return (
    <section className="editor-surface mb-4" aria-label="Transaction evidence">
      <div className="section-header">
        <h2>{row.description} · Bank evidence</h2>
        <Button variant="outline" onClick={onClose}>
          Close evidence
        </Button>
      </div>
      <p className="metadata">
        Review and clearing are independent. Gmail notifications alone do not
        verify bank posting.
      </p>
      {data.isPending && <LoadingState />}
      {data.error && <ErrorState text={data.error.message} />}
      {data.data && (
        <>
          <p>{data.data.clearing_status}</p>
          <div className="filter-bar">
            <Field label="Bank posting date">
              <input
                type="date"
                value={bankDate}
                onChange={(e) => setBankDate(e.target.value)}
                disabled={!!sourceId}
              />
            </Field>
            <Field label="Clearing evidence">
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="">Manual statement verification</option>
                {data.data.sources
                  .filter((s) => !s.detached && s.source_type !== 'GMAIL')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.source_type} ·{' '}
                      {String(s.candidate.transaction_date ?? '')}
                    </option>
                  ))}
              </select>
            </Field>
            <Button
              disabled={
                mutation.isPending || data.data.clearing_status === 'RECONCILED'
              }
              onClick={() =>
                mutation.mutate({
                  path: `/transactions/${row.id}/clearing`,
                  data: newCommand({
                    cleared: data.data.clearing_status === 'UNCLEARED',
                    source_id: sourceId || null,
                    bank_date: bankDate,
                  }),
                })
              }
            >
              {data.data.clearing_status === 'UNCLEARED'
                ? 'Mark cleared'
                : 'Mark uncleared'}
            </Button>
          </div>
          {data.data.statement_ids.length > 0 && (
            <p className="metadata">
              Reopen the completed statement in Reconcile → Statements before
              editing.
            </p>
          )}
          {!data.data.sources.length && (
            <p className="metadata">Manual entry · no imported sources.</p>
          )}
          {data.data.sources.map((source) => (
            <details className="py-2" key={source.id}>
              <summary>
                {source.source_type} ·{' '}
                {String(source.candidate.transaction_date ?? '')} ·{' '}
                {source.detached ? 'Detached (history retained)' : 'Linked'}
              </summary>
              <pre className="overflow-auto text-xs">
                {JSON.stringify(source.raw, null, 2)}
              </pre>
            </details>
          ))}
        </>
      )}
      {mutation.error && <ErrorState text={mutation.error.message} />}
    </section>
  )
}
