import { useState } from 'react'
import { useSection } from '@/lib/navigation'
import { SectionNavigation } from '@/components/section-navigation'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
} from '@/components/primitives'
import {
  request,
  localDate,
  getTransactionPage,
  type Account,
  type Category,
} from '@/lib/api'
import { decimalUnits } from '@/lib/money'
import { useWrite } from '@/lib/use-write'
import {
  getCandidates,
  getStatements,
  newCommand,
  type MatchCandidate,
  type Statement,
} from '@/lib/reconciliation-api'
import { getImport } from '@/lib/ingestion-api'
import { ImportReview } from './import-workspace'
import DuplicateReview from './duplicate-review'

export default function Reconciliation({
  accounts,
  categories,
  account,
}: {
  accounts: Account[]
  categories: Category[]
  account?: Account
}) {
  const sections = [
    ['sources', 'Source matching'],
    ['statements', 'Statements'],
    ['duplicates', 'Existing duplicates'],
    ['history', 'Decision history'],
  ] as const
  const [view, setView] = useSection(
    sections.map(([key]) => key),
    account ? 'statements' : 'sources',
    'reconcile',
  )
  return (
    <>
      <PageHeader
        title="Reconciliation"
        description="Match source evidence and verify posted bank balances. Review status stays independent."
      />
      <SectionNavigation
        label="Reconciliation views"
        items={sections}
        value={view}
        onChange={setView}
      />
      <p className="metadata workflow-context">
        Link evidence first, clear verified entries, then complete a statement
        only when its difference is zero. Marking a transaction reviewed does
        not clear or reconcile it.
      </p>
      {view === 'sources' ? (
        <SourceQueue accounts={accounts} categories={categories} />
      ) : view === 'statements' ? (
        <Statements accounts={accounts} account={account} />
      ) : view === 'duplicates' ? (
        <DuplicateReview />
      ) : (
        <DecisionHistory />
      )}
    </>
  )
}

function SourceQueue({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const [offset, setOffset] = useState(0)
  const [opened, setOpened] = useState<string>()
  const mutation = useWrite()
  const rows = useQuery({
    queryKey: ['reconciliation', 'sources', offset],
    queryFn: () => getCandidates(offset),
  })
  const batch = useQuery({
    queryKey: ['imports', opened],
    queryFn: () => getImport(opened!),
    enabled: !!opened,
  })
  if (opened && batch.data)
    return (
      <>
        {mutation.error && <ErrorState text={mutation.error.message} />}
        <ImportReview
          batch={batch.data}
          accounts={accounts}
          categories={categories}
          busy={mutation.isPending}
          onBack={() => setOpened(undefined)}
          onDecision={async (row, data) => {
            await mutation.mutateAsync({
              path: `/imports/${opened}/rows/${row.id}`,
              method: 'PATCH',
              data,
            })
          }}
          onConfirm={async () => {
            await mutation.mutateAsync({
              path: `/imports/${opened}/confirm`,
              data: {
                preview_token: batch.data.preview_token,
                account_confirmed: true,
              },
            })
          }}
        />
      </>
    )
  return (
    <>
      {rows.isPending && <LoadingState />}
      {rows.error && <ErrorState text={rows.error.message} />}
      {batch.error && <ErrorState text={batch.error.message} />}
      {rows.data?.length === 0 && (
        <EmptyState
          title="No source records yet"
          detail="Import a statement or review Gmail candidates to compare evidence."
        />
      )}
      <div className="divide-y divide-border">
        {rows.data?.map((row) => (
          <SourceItem
            key={row.id}
            row={row}
            account={accounts.find((a) => a.id === row.account_id)}
            onReview={() => setOpened(row.batch_id)}
          />
        ))}
      </div>
      <div className="page-actions mt-4">
        <Button
          variant="outline"
          disabled={!offset}
          onClick={() => setOffset(offset - 50)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={(rows.data?.length ?? 0) < 50}
          onClick={() => setOffset(offset + 50)}
        >
          Next
        </Button>
      </div>
    </>
  )
}

function SourceItem({
  row,
  account,
  onReview,
}: {
  row: MatchCandidate
  account?: Account
  onReview: () => void
}) {
  const mutation = useWrite()
  const [target, setTarget] = useState('')
  const [expanded, setExpanded] = useState(false)
  const targets = useQuery({
    queryKey: ['reconciliation', 'targets', row.id],
    enabled: expanded,
    queryFn: () =>
      getTransactionPage(
        new URLSearchParams({
          account_id: row.account_id,
          amount_min: String(row.candidate.amount ?? '0'),
          amount_max: String(row.candidate.amount ?? '0'),
          limit: '200',
        }),
      ),
  })
  const [reason, setReason] = useState('')
  function act(action: string) {
    mutation.mutate({
      path: `/reconciliation/sources/${row.id}`,
      data: newCommand({
        action,
        token: row.token,
        reason,
        transaction_id: target || null,
      }),
    })
  }
  return (
    <details
      className="py-3"
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm">
        {row.source_type} ·{' '}
        {String(row.candidate.description ?? 'Unparsed record')} ·{' '}
        {account?.name} ·{' '}
        {row.detached
          ? 'Detached'
          : row.dismissed
            ? 'Dismissed'
            : row.classification.replaceAll('_', ' ')}
      </summary>
      <div className="grid gap-3 py-3 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Incoming evidence</h3>
          <p className="metadata">
            {String(row.candidate.transaction_date ?? '')} · {row.reason}
          </p>
          {typeof row.candidate.amount === 'string' &&
            typeof row.candidate.currency === 'string' && (
              <Money
                value={row.candidate.amount}
                currency={row.candidate.currency}
              />
            )}
          <p className="metadata">
            Ledger metadata is preserved when linking. Conflicting amounts
            cannot be linked.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Existing ledger alternatives</h3>
          {row.matches.map((match) => (
            <div className="py-2" key={match.id}>
              <p>
                {match.description} · {match.transaction_date} ·{' '}
                <Money value={match.amount} currency={match.currency} />
              </p>
              <p className="metadata">{match.evidence.join(' · ')}</p>
              <p className="metadata">
                Payee: {match.payee?.name ?? 'Unassigned'} · Category:{' '}
                {match.category_id ?? 'Unassigned'}
              </p>
            </div>
          ))}
          {!row.matches.length && (
            <p className="metadata">No compatible linked alternative.</p>
          )}
        </div>
      </div>
      {row.batch_status === 'DRAFT' && (
        <Button variant="outline" onClick={onReview}>
          Review import / keep separate
        </Button>
      )}
      <div className="filter-bar mt-3">
        <Field label="Correction reason">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </Field>
        <Field label="Existing ledger transaction">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose transaction</option>
            {targets.data?.rows.map((tx) => (
              <option key={tx.id} value={tx.id}>
                {tx.transaction_date} ? {tx.payee?.name ?? tx.description}
              </option>
            ))}
          </select>
        </Field>
        {[
          'REJECT',
          row.dismissed ? 'REOPEN' : 'DISMISS',
          ...(row.batch_status === 'COMPLETED' ? ['UNLINK', 'LINK'] : []),
        ].map((action) => (
          <Button
            key={action}
            size="sm"
            variant="outline"
            disabled={
              mutation.isPending ||
              !reason ||
              (['REJECT', 'LINK'].includes(action) && !target)
            }
            onClick={() => act(action)}
          >
            {action === 'LINK' ? 'Reassign source' : action.toLowerCase()}
          </Button>
        ))}
      </div>
      {mutation.error && <ErrorState text={mutation.error.message} />}
    </details>
  )
}

function Statements({
  accounts,
  account,
}: {
  accounts: Account[]
  account?: Account
}) {
  const [accountId, setAccountId] = useState(
    account?.id ?? accounts.find((a) => a.type !== 'INVESTMENT')?.id ?? '',
  )
  const [cutoff, setCutoff] = useState(localDate())
  const [balance, setBalance] = useState('')
  const [notes, setNotes] = useState('')
  const mutation = useWrite()
  const rows = useQuery({
    queryKey: ['reconciliation', 'statements', accountId],
    queryFn: () => getStatements(accountId),
    enabled: !!accountId,
  })
  return (
    <>
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate({
            path: '/reconciliation/sessions',
            data: newCommand({
              account_id: accountId,
              cutoff,
              ending_balance: balance,
              notes,
            }),
          })
        }}
      >
        <Field label="Statement account">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts
              .filter((a) => a.type !== 'INVESTMENT')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Statement cutoff">
          <input
            type="date"
            required
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
          />
        </Field>
        <Field label="Ending balance">
          <input
            inputMode="decimal"
            required
            pattern="-?[0-9]+(\.[0-9]{1,6})?"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </Field>
        <Field label="Reference / notes">
          <input
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <Button disabled={mutation.isPending || !accountId}>
          Start reconciliation
        </Button>
      </form>
      <p className="metadata my-3">
        Enter card liabilities as negative balances. Verify opening history
        explicitly. No balancing adjustment is created.
      </p>
      {mutation.error && <ErrorState text={mutation.error.message} />}
      {rows.error && <ErrorState text={rows.error.message} />}
      {rows.isPending && accountId && <LoadingState />}
      {rows.data?.length === 0 && <EmptyState title="No statements yet" />}
      {rows.data?.map((row) => (
        <StatementReview key={row.id} row={row} />
      ))}
    </>
  )
}

function StatementReview({ row }: { row: Statement }) {
  const mutation = useWrite()
  const [reason, setReason] = useState('')
  return (
    <details
      className="border-b border-border py-3"
      open={row.status !== 'COMPLETED'}
    >
      <summary className="cursor-pointer">
        {row.cutoff} · {row.status} ·{' '}
        <Money value={row.statement_balance} currency={row.currency} />
      </summary>
      <div className="flex flex-wrap gap-6 py-3">
        <div>
          Cleared balance
          <br />
          <Money value={row.cleared_balance} currency={row.currency} />
        </div>
        <div>
          Difference
          <br />
          <Money value={row.difference} currency={row.currency} />
          <p className="metadata">
            Exact difference: {row.difference} {row.currency}
          </p>
        </div>
      </div>
      {!!row.pending_source_ids?.length && (
        <p role="alert">
          Resolve {row.pending_source_ids.length} pending bank sources in Source
          matching before completing.
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Bank status</th>
            </tr>
          </thead>
          <tbody>
            {row.transactions.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.transaction_date}</td>
                <td>
                  {tx.description}
                  {row.settlement_after_cutoff_ids?.includes(tx.id) && (
                    <small className="metadata block">
                      Bank source is after this cutoff; excluded
                    </small>
                  )}
                </td>
                <td className="amount-cell">
                  <Money
                    value={tx.amount}
                    currency={tx.currency}
                    prefix={tx.direction === 'OUT' ? '−' : '+'}
                  />
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      row.status === 'COMPLETED' ||
                      tx.clearing_status === 'RECONCILED' ||
                      mutation.isPending
                    }
                    onClick={() =>
                      mutation.mutate({
                        path: `/transactions/${tx.id}/clearing`,
                        data: newCommand({
                          cleared: tx.clearing_status === 'UNCLEARED',
                          bank_date: row.cutoff,
                        }),
                      })
                    }
                  >
                    {tx.clearing_status}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="filter-bar mt-3">
        <Field label="Statement decision reason">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </Field>
        <Button
          disabled={
            mutation.isPending ||
            !reason ||
            (row.status !== 'COMPLETED' && decimalUnits(row.difference) !== 0n)
          }
          onClick={() =>
            mutation.mutate({
              path: `/reconciliation/sessions/${row.id}`,
              data: newCommand({
                action: row.status === 'COMPLETED' ? 'REOPEN' : 'COMPLETE',
                token: row.token,
                reason,
              }),
            })
          }
        >
          {row.status === 'COMPLETED'
            ? 'Reopen this and later statements'
            : 'Complete and lock'}
        </Button>
      </div>
      {mutation.error && <ErrorState text={mutation.error.message} />}
    </details>
  )
}

function DecisionHistory() {
  const [offset, setOffset] = useState(0)
  const rows = useQuery({
    queryKey: ['reconciliation', 'history', offset],
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.string(),
            action: z.string(),
            actor: z.string(),
            created_at: z.string(),
            details: z.record(z.string(), z.unknown()),
          }),
        )
        .parse(await request(`/reconciliation/history?offset=${offset}`)),
  })
  return (
    <>
      {rows.isPending && <LoadingState />}
      {rows.error && <ErrorState text={rows.error.message} />}
      {rows.data?.map((row) => (
        <details key={row.id} className="py-2 border-b border-border">
          <summary>
            {row.action.replaceAll('_', ' ')} · {row.actor} · {row.created_at}
          </summary>
          <pre className="overflow-auto text-xs">
            {JSON.stringify(row.details, null, 2)}
          </pre>
        </details>
      ))}
      <div className="page-actions mt-3">
        <Button
          variant="outline"
          disabled={!offset}
          onClick={() => setOffset(offset - 100)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={(rows.data?.length ?? 0) < 100}
          onClick={() => setOffset(offset + 100)}
        >
          Next
        </Button>
      </div>
    </>
  )
}
