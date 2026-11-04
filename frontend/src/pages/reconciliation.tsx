import { t as tr, ui } from '@/lib/i18n'
import { useState } from 'react'
import { useSection, useRoute, navigateTo } from '@/lib/navigation'
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
        title={tr('reconciliation:reconciliation_b29da9')}
        description={tr(
          'reconciliation:match_source_evidence_and_verify_posted_bank_bal_9a2da5',
        )}
      />
      <SectionNavigation
        label={tr('reconciliation:reconciliation_views_5e980b')}
        items={sections}
        value={view}
        onChange={setView}
      />
      <p className="metadata workflow-context">
        {tr(
          'reconciliation:link_evidence_first_clear_verified_entries_then__d936dd',
        )}
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
          title={tr('reconciliation:no_source_records_yet_8e59cc')}
          detail={tr(
            'reconciliation:import_a_statement_or_review_gmail_candidates_to_3a19c7',
          )}
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
          {tr('reconciliation:previous_50f942')}
        </Button>
        <Button
          variant="outline"
          disabled={(rows.data?.length ?? 0) < 50}
          onClick={() => setOffset(offset + 50)}
        >
          {tr('reconciliation:next_bc9819')}
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
          ? tr('dynamic:detached_bbbf4e')
          : row.dismissed
            ? tr('dynamic:dismissed_e8db5f')
            : row.classification.replaceAll('_', ' ')}
      </summary>
      <div className="grid gap-3 py-3 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">
            {tr('reconciliation:incoming_evidence_0233f2')}
          </h3>
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
            {tr(
              'reconciliation:ledger_metadata_is_preserved_when_linking_confli_8f0007',
            )}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium">
            {tr('reconciliation:existing_ledger_alternatives_dd1ed3')}
          </h3>
          {row.matches.map((match) => (
            <div className="py-2" key={match.id}>
              <p>
                {match.description} · {match.transaction_date} ·{' '}
                <Money value={match.amount} currency={match.currency} />
              </p>
              <p className="metadata">{match.evidence.join(' · ')}</p>
              <p className="metadata">
                {' '}
                {tr('reconciliation:payee__704e06')}{' '}
                {match.payee?.name ?? tr('dynamic:unassigned_e57016')}{' '}
                {tr('reconciliation:_category__cece31')}{' '}
                {match.category_id ?? tr('dynamic:unassigned_e57016')}
              </p>
            </div>
          ))}
          {!row.matches.length && (
            <p className="metadata">
              {tr('reconciliation:no_compatible_linked_alternative__f17094')}
            </p>
          )}
        </div>
      </div>
      {row.batch_status === 'DRAFT' && (
        <Button variant="outline" onClick={onReview}>
          {tr('reconciliation:review_import_keep_separate_3759fc')}
        </Button>
      )}
      <div className="filter-bar mt-3">
        <Field label={tr('reconciliation:correction_reason_a09190')}>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </Field>
        <Field label={tr('reconciliation:existing_ledger_transaction_d09a5c')}>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">
              {tr('reconciliation:choose_transaction_1ffa24')}
            </option>
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
            {action === 'LINK'
              ? tr('dynamic:reassign_source_209728')
              : action.toLowerCase()}
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
  const route = useRoute()
  const selected = route.params.get('statement')
  const select = (statement: string, accountId: string) =>
    navigateTo('Transactions', undefined, {
      ...Object.fromEntries(route.params),
      view: 'reconciliation',
      reconcile: 'statements',
      statement,
      statement_account: accountId,
    })
  const [accountId, setAccountId] = useState(
    route.params.get('statement_account') ??
      account?.id ??
      accounts.find((a) => a.type !== 'INVESTMENT')?.id ??
      '',
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
  if (selected)
    return (
      <section className="statement-workbench">
        <Button variant="ghost" onClick={() => select('', accountId)}>
          {tr('parity:back_to_statements')}
        </Button>
        {rows.isPending ? (
          <LoadingState />
        ) : rows.isError ? (
          <ErrorState
            text={rows.error.message}
            retry={() => void rows.refetch()}
          />
        ) : rows.data.find((r) => r.id === selected) ? (
          <StatementReview
            row={rows.data.find((r) => r.id === selected)!}
            accountName={
              accounts.find((a) => a.id === accountId)?.name ?? accountId
            }
          />
        ) : (
          <EmptyState title={tr('common:unavailable')} />
        )}
      </section>
    )
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
        <Field label={tr('reconciliation:statement_account_b27094')}>
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
        <Field label={tr('reconciliation:statement_cutoff_85cd8e')}>
          <input
            type="date"
            required
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
          />
        </Field>
        <Field label={tr('reconciliation:ending_balance_ea39ad')}>
          <input
            inputMode="decimal"
            required
            pattern="-?[0-9]+(\.[0-9]{1,6})?"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </Field>
        <Field label={tr('reconciliation:reference_notes_06b029')}>
          <input
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <Button disabled={mutation.isPending || !accountId}>
          {tr('reconciliation:start_reconciliation_8892d5')}
        </Button>
      </form>
      <p className="metadata my-3">
        {tr(
          'reconciliation:enter_card_liabilities_as_negative_balances_veri_18f556',
        )}
      </p>
      {mutation.error && <ErrorState text={mutation.error.message} />}
      {rows.error && <ErrorState text={rows.error.message} />}
      {rows.isPending && accountId && <LoadingState />}
      {rows.data?.length === 0 && (
        <EmptyState title={tr('reconciliation:no_statements_yet_ec4e6d')} />
      )}
      {rows.data?.map((row) => (
        <button
          className="statement-list-row"
          key={row.id}
          onClick={() => select(row.id, accountId)}
        >
          <span>
            {row.cutoff} - {ui(row.status)}
          </span>
          <Money value={row.statement_balance} currency={row.currency} />
        </button>
      ))}
    </>
  )
}

function StatementReview({
  row,
  accountName,
}: {
  row: Statement
  accountName: string
}) {
  const mutation = useWrite()
  const [reason, setReason] = useState('')
  return (
    <section className="statement-detail">
      <h1>
        {row.cutoff} · {ui(row.status)} ·{' '}
        <Money value={row.statement_balance} currency={row.currency} />
      </h1>
      <p className="metadata">
        {accountName} - {row.currency} - {tr('parity:revision')} {row.revision}
      </p>
      <div className="flex flex-wrap gap-6 py-3">
        <div>
          {tr('parity:statement_balance')}
          <br />
          <Money value={row.statement_balance} currency={row.currency} />
        </div>
        <div>
          {' '}
          {tr('reconciliation:cleared_balance_113543')} <br />
          <Money value={row.cleared_balance} currency={row.currency} />
        </div>
        <div>
          {' '}
          {tr('reconciliation:difference_b16f1f')} <br />
          <Money value={row.difference} currency={row.currency} />
          <p className="metadata">
            {' '}
            {tr('reconciliation:exact_difference__7daa47')} {row.difference}{' '}
            {row.currency}
          </p>
        </div>
      </div>
      {!!row.pending_source_ids?.length && (
        <p role="alert">
          {' '}
          {tr('reconciliation:resolve_ac7f95')} {row.pending_source_ids.length}{' '}
          {tr(
            'reconciliation:pending_bank_sources_in_source_matching_before_c_24cd42',
          )}{' '}
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{tr('reconciliation:date_eb9a4b')}</th>
              <th>{tr('reconciliation:description_55f8eb')}</th>
              <th>{tr('reconciliation:amount_43dc85')}</th>
              <th>{tr('reconciliation:bank_status_03c91a')}</th>
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
                      {tr(
                        'reconciliation:bank_source_is_after_this_cutoff_excluded_0bf3a5',
                      )}
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
        <Field label={tr('reconciliation:statement_decision_reason_6b6719')}>
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
          onClick={() => {
            if (
              row.status === 'COMPLETED' &&
              !window.confirm(tr('parity:reopen_statement'))
            )
              return
            mutation.mutate({
              path: `/reconciliation/sessions/${row.id}`,
              data: newCommand({
                action: row.status === 'COMPLETED' ? 'REOPEN' : 'COMPLETE',
                token: row.token,
                reason,
              }),
            })
          }}
        >
          {row.status === 'COMPLETED'
            ? tr('dynamic:reopen_this_and_later_statements_e9a06b')
            : tr('dynamic:complete_and_lock_66348a')}
        </Button>
      </div>
      {mutation.error && <ErrorState text={mutation.error.message} />}
    </section>
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
          {tr('reconciliation:previous_50f942')}
        </Button>
        <Button
          variant="outline"
          disabled={(rows.data?.length ?? 0) < 100}
          onClick={() => setOffset(offset + 100)}
        >
          {tr('reconciliation:next_bc9819')}
        </Button>
      </div>
    </>
  )
}
