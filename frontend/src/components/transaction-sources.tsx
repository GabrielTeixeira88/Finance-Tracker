import { t as tr } from '@/lib/i18n'
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
    <section
      className="editor-surface mb-4"
      aria-label={tr('transaction_sources:transaction_evidence_fb8d54')}
    >
      <div className="section-header">
        <h2>
          {row.description}{' '}
          {tr('transaction_sources:_bank_evidence_7dc0ed')}{' '}
        </h2>
        <Button variant="outline" onClick={onClose}>
          {tr('transaction_sources:close_evidence_c2fd16')}
        </Button>
      </div>
      <p className="metadata">
        {tr(
          'transaction_sources:review_and_clearing_are_independent_gmail_notifi_3ce5ed',
        )}
      </p>
      {data.isPending && <LoadingState />}
      {data.error && <ErrorState text={data.error.message} />}
      {data.data && (
        <>
          <p>{data.data.clearing_status}</p>
          <div className="filter-bar">
            <Field label={tr('transaction_sources:bank_posting_date_8c129a')}>
              <input
                type="date"
                value={bankDate}
                onChange={(e) => setBankDate(e.target.value)}
                disabled={!!sourceId}
              />
            </Field>
            <Field label={tr('transaction_sources:clearing_evidence_f08ff5')}>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="">
                  {tr(
                    'transaction_sources:manual_statement_verification_625c0c',
                  )}
                </option>
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
                ? tr('dynamic:mark_cleared_6461b2')
                : tr('dynamic:mark_uncleared_ed52fb')}
            </Button>
          </div>
          {data.data.statement_ids.length > 0 && (
            <p className="metadata">
              {tr(
                'transaction_sources:reopen_the_completed_statement_in_reconcile_stat_b86651',
              )}
            </p>
          )}
          {!data.data.sources.length && (
            <p className="metadata">
              {tr(
                'transaction_sources:manual_entry_no_imported_sources__4390f2',
              )}
            </p>
          )}
          {data.data.sources.map((source) => (
            <details className="py-2" key={source.id}>
              <summary>
                {source.source_type} ·{' '}
                {String(source.candidate.transaction_date ?? '')} ·{' '}
                {source.detached
                  ? tr('dynamic:detached_history_retained__814331')
                  : tr('dynamic:linked_a089f6')}
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
