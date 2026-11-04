import { t as tr } from '@/lib/i18n'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request, transactionSchema } from '@/lib/api'
import { newCommand } from '@/lib/reconciliation-api'
import { useWrite } from '@/lib/use-write'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
} from '@/components/primitives'

const preview = z.object({
  survivor: transactionSchema,
  duplicate: transactionSchema,
  blockers: z.array(z.string()),
  balance_change: z.string(),
  token: z.string(),
  survivor_sources: z.array(z.unknown()),
  duplicate_sources: z.array(z.unknown()),
})
type Preview = z.infer<typeof preview>
export default function DuplicateReview() {
  const [offset, setOffset] = useState(0)
  const data = useQuery({
    queryKey: ['reconciliation', 'duplicates', offset],
    queryFn: async () =>
      z
        .array(preview)
        .parse(await request(`/reconciliation/duplicates?offset=${offset}`)),
  })
  return (
    <>
      <p className="metadata mb-3">
        {tr(
          'duplicate_review:these_are_suggestions_not_proven_duplicates_choo_f4d8f8',
        )}
      </p>
      {data.isPending && <LoadingState />}
      {data.error && <ErrorState text={data.error.message} />}
      {data.data?.length === 0 && (
        <EmptyState
          title={tr(
            'duplicate_review:no_duplicate_suggestions_in_this_comparison_wind_e60e81',
          )}
        />
      )}
      {data.data?.map((row) => (
        <MergePair key={row.survivor.id + row.duplicate.id} initial={row} />
      ))}
      <div className="page-actions mt-3">
        <Button
          variant="outline"
          disabled={!offset}
          onClick={() => setOffset(offset - 50)}
        >
          {tr('duplicate_review:previous_comparisons_c8626c')}
        </Button>
        <Button variant="outline" onClick={() => setOffset(offset + 50)}>
          {tr('duplicate_review:next_comparisons_3cee68')}
        </Button>
      </div>
    </>
  )
}
function MergePair({ initial }: { initial: Preview }) {
  const [swap, setSwap] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const survivor = swap ? initial.duplicate : initial.survivor
  const duplicate = swap ? initial.survivor : initial.duplicate
  const data = useQuery({
    queryKey: ['reconciliation', 'merge', survivor.id, duplicate.id],
    queryFn: async () =>
      preview.parse(
        await request(
          `/reconciliation/merge-preview?survivor_id=${survivor.id}&duplicate_id=${duplicate.id}`,
        ),
      ),
  })
  const mutation = useWrite()
  const shown = data.data
  return (
    <details className="py-3 border-b border-border">
      <summary>
        {survivor.description} ·{' '}
        <Money value={survivor.amount} currency={survivor.currency} /> ·{' '}
        {survivor.transaction_date} / {duplicate.transaction_date}
      </summary>
      <div className="grid gap-4 py-3 md:grid-cols-2">
        {[survivor, duplicate].map((row, index) => (
          <div key={row.id}>
            <h3 className="text-sm font-medium">
              {index
                ? tr('dynamic:remove_duplicate_posting_47ef66')
                : tr('dynamic:keep_this_entry_f82b49')}
            </h3>
            <p>{row.payee?.name ?? row.description}</p>
            <p className="metadata">
              {row.description} · {row.transaction_date} · {row.review_status}
            </p>
            <p className="metadata">
              {' '}
              {tr('duplicate_review:category__61b920')}{' '}
              {row.category_id ?? tr('dynamic:unassigned_e57016')}
            </p>
            <Money value={row.amount} currency={row.currency} />
          </div>
        ))}
      </div>
      {shown && (
        <>
          <p>
            {' '}
            {tr('duplicate_review:account_balance_change__5d1de7')}{' '}
            <Money value={shown.balance_change} currency={survivor.currency} />
          </p>
          <p className="metadata">
            {tr(
              'duplicate_review:survivor_metadata_is_retained_sources_move_to_it_05a412',
            )}
          </p>
          <details>
            <summary>{tr('duplicate_review:source_evidence_149bdd')}</summary>
            <pre className="overflow-auto text-xs">
              {JSON.stringify(
                {
                  keep: shown.survivor_sources,
                  duplicate: shown.duplicate_sources,
                },
                null,
                2,
              )}
            </pre>
          </details>
          {shown.blockers.map((b) => (
            <p role="alert" key={b}>
              {b}
            </p>
          ))}
          <div className="flex gap-3 items-center py-3">
            <Button
              variant="outline"
              onClick={() => {
                setSwap(!swap)
                setConfirmed(false)
              }}
            >
              {tr('duplicate_review:swap_survivor_e0fd74')}
            </Button>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{' '}
              {tr(
                'duplicate_review:i_verified_these_are_the_same_event_861bbd',
              )}{' '}
            </label>
            <Button
              disabled={
                !confirmed || !!shown.blockers.length || mutation.isPending
              }
              onClick={() =>
                mutation.mutate({
                  path: '/reconciliation/merge',
                  data: newCommand({
                    survivor_id: survivor.id,
                    duplicate_id: duplicate.id,
                    token: shown.token,
                  }),
                })
              }
            >
              {tr('duplicate_review:merge_confirmed_duplicate_29aad3')}
            </Button>
          </div>
        </>
      )}
      {data.error && <ErrorState text={data.error.message} />}{' '}
      {mutation.error && <ErrorState text={mutation.error.message} />}
    </details>
  )
}
