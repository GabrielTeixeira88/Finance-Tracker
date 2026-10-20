import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field, TransactionForm, TransactionComposer } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { TransactionTable } from '@/components/transaction-table'
import { TransactionSources } from '@/components/transaction-sources'
import { PageHeader, Money, LoadingState } from '@/components/primitives'
import { useWrite } from '@/lib/use-write'
import {
  BulkTransactionActions,
  ReviewTransaction,
} from '@/components/transaction-review'
import { RuleEditor } from '@/pages/rules'
import { rememberLedgerFilters } from '@/lib/navigation'
import { decimalUnits } from '@/lib/money'
import {
  getTransactionPage,
  openingInput,
  transactionTypes,
  label,
  type Account,
  type Category,
  type Transaction,
} from '@/lib/api'

export default function Transactions({
  accounts,
  categories,
  account,
  initialFilters,
}: {
  accounts: Account[]
  categories: Category[]
  initialFilters?: Record<string, string>
  account?: Account
}) {
  const [ruleSource, setRuleSource] = useState<Transaction>()
  const [editing, setEditing] = useState<Transaction>()
  const [inspecting, setInspecting] = useState<Transaction>()
  const [creating, setCreating] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({
    ...initialFilters,
    ...(account ? { account_id: account.id } : {}),
  })
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  )
  params.set('limit', '50')
  params.set('offset', String(offset))
  const invalidDates = !!(
    filters.date_from &&
    filters.date_to &&
    filters.date_from > filters.date_to
  )
  const invalidAmounts =
    [filters.amount_min, filters.amount_max].some(
      (value) => value && !openingInput.safeParse(value).success,
    ) ||
    !!(
      filters.amount_min &&
      filters.amount_max &&
      openingInput.safeParse(filters.amount_min).success &&
      openingInput.safeParse(filters.amount_max).success &&
      decimalUnits(filters.amount_min) > decimalUnits(filters.amount_max)
    )
  const invalidRange = invalidDates || invalidAmounts
  const rows = useQuery({
    queryKey: ['transactions', params.toString()],
    queryFn: ({ signal }) => getTransactionPage(params, signal),
    enabled: !invalidRange,
  })
  const mutation = useWrite()
  function filter(key: string, value: string) {
    const next = {
      ...filters,
      ...(key === 'category_id' ? { uncategorized: '' } : {}),
      [key]: value,
    }
    setFilters(next)
    rememberLedgerFilters(next)
    setOffset(0)
    setSelected([])
  }
  return (
    <>
      {inspecting && (
        <TransactionSources
          row={inspecting}
          onClose={() => setInspecting(undefined)}
        />
      )}
      <PageHeader
        title={account?.name ?? 'Transactions'}
        description={
          account
            ? `${label(account.type)} · ${account.currency}${account.active ? '' : ' · Inactive'}`
            : 'Your financial ledger. Transfers stay separate from spending.'
        }
      >
        <Button
          onClick={() => {
            setEditing(undefined)
            setCreating(!creating)
          }}
        >
          {creating ? 'Close form' : '+ Add Transaction'}
        </Button>
      </PageHeader>
      {account && (
        <div className="account-detail-strip">
          <span className="metadata">
            Calculated balance · All recorded dates
          </span>
          <Money value={account.balance} currency={account.currency} />
          <span className="metadata">
            {account.institution ?? 'No institution'}
          </span>
        </div>
      )}
      {ruleSource && (
        <RuleEditor
          key={ruleSource.id}
          initialDraft={{
            name: `Classify ${ruleSource.payee?.name ?? ruleSource.description}`.slice(
              0,
              120,
            ),
            enabled: true,
            priority: 100,
            match_mode: 'ALL',
            conditions: [
              {
                field: 'description',
                operator: 'contains',
                value: ruleSource.description,
              },
            ],
            actions: {
              payee_id: ruleSource.payee_id,
              category_id: ruleSource.category_id,
            },
          }}
          accounts={accounts}
          categories={categories}
          onSaved={() => setRuleSource(undefined)}
          valueName={(field, value) =>
            field === 'category_id'
              ? (categories.find((c) => c.id === value)?.name ?? 'Category')
              : field === 'payee_id'
                ? (ruleSource.payee?.name ?? 'Payee')
                : (value ?? '')
          }
        />
      )}
      {creating && (
        <TransactionComposer
          accounts={accounts}
          categories={categories}
          onSaved={() => {
            setCreating(false)
            setOffset(0)
          }}
        />
      )}
      {editing && !['INCOME', 'EXPENSE'].includes(editing.transaction_type) ? (
        <ReviewTransaction
          key={editing.id}
          row={editing}
          onSaved={() => setEditing(undefined)}
        />
      ) : (
        editing && (
          <TransactionForm
            key={editing?.id ?? 'new'}
            transaction={editing}
            accounts={account ? [account] : accounts}
            categories={categories}
            onSaved={() => {
              setEditing(undefined)
              setCreating(false)
              setOffset(0)
            }}
          />
        )
      )}
      <section className="panel">
        <h2>Transaction history</h2>
        {(filters.spending_only ||
          filters.uncategorized ||
          filters.payee_id ||
          filters.currency) && (
          <p className="metadata">
            Spending drill-down: {filters.currency}{' '}
            {filters.uncategorized ? ' / Uncategorized' : ''}. Linked refunds
            reduce spending.{' '}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters(account ? { account_id: account.id } : {})
                rememberLedgerFilters(account ? { account_id: account.id } : {})
                setOffset(0)
                setSelected([])
              }}
            >
              Clear drill-down filters
            </Button>
          </p>
        )}
        <div className="filter-bar">
          <Field label="Search transactions">
            <input
              type="search"
              maxLength={500}
              placeholder="Description, merchant or payee"
              value={filters.search ?? ''}
              onChange={(e) => filter('search', e.target.value)}
            />
          </Field>
          <Field label="Filter account">
            <select
              disabled={!!account}
              value={filters.account_id ?? ''}
              onChange={(e) => filter('account_id', e.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Filter type">
            <select
              value={filters.transaction_type ?? ''}
              onChange={(e) => filter('transaction_type', e.target.value)}
            >
              <option value="">All types</option>
              {transactionTypes.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Filter category">
            <select
              value={filters.category_id ?? ''}
              onChange={(e) => filter('category_id', e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <details
          className="ledger-advanced"
          open={
            !!(
              filters.date_from ||
              filters.date_to ||
              filters.amount_min ||
              filters.amount_max ||
              filters.review_status ||
              filters.clearing_status
            )
          }
        >
          <summary>
            More filters - dates, review, bank status and amount
          </summary>
          <div className="filter-bar">
            <Field label="From date">
              <input
                type="date"
                value={filters.date_from ?? ''}
                onChange={(e) => filter('date_from', e.target.value)}
              />
            </Field>
            <Field label="To date">
              <input
                type="date"
                value={filters.date_to ?? ''}
                onChange={(e) => filter('date_to', e.target.value)}
              />
            </Field>
            <Field label="Filter review">
              <select
                value={filters.review_status ?? ''}
                onChange={(e) => filter('review_status', e.target.value)}
              >
                <option value="">All review states</option>
                <option value="NEEDS_REVIEW">Needs review</option>
                <option value="REVIEWED">Reviewed</option>
              </select>
            </Field>
            <Field label="Bank status">
              <select
                value={filters.clearing_status ?? ''}
                onChange={(e) => filter('clearing_status', e.target.value)}
              >
                <option value="">All bank states</option>
                <option value="UNCLEARED">Uncleared</option>
                <option value="CLEARED">Cleared</option>
                <option value="RECONCILED">Reconciled</option>
              </select>
            </Field>
            <Field label="Minimum amount">
              <input
                inputMode="decimal"
                value={filters.amount_min ?? ''}
                onChange={(e) => filter('amount_min', e.target.value)}
              />
            </Field>
            <Field label="Maximum amount">
              <input
                inputMode="decimal"
                value={filters.amount_max ?? ''}
                onChange={(e) => filter('amount_max', e.target.value)}
              />
            </Field>
            <Field label="Sort transactions">
              <select
                value={filters.sort ?? 'date_desc'}
                onChange={(e) => filter('sort', e.target.value)}
              >
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
              </select>
            </Field>
          </div>
        </details>
        <p className="metadata">
          Amount filters use positive magnitudes in each record’s original
          currency. Review is separate from bank reconciliation.
        </p>
        {selected.length > 0 && !invalidRange && !rows.isError && rows.data && (
          <BulkTransactionActions
            key={selected.join(',')}
            rows={rows.data.rows.filter((row) => selected.includes(row.id))}
            categories={categories}
            refreshing={rows.isFetching}
            onSaved={() => {
              setSelected([])
              setEditing(undefined)
            }}
          />
        )}
        {invalidRange ? (
          <p role="alert">
            {invalidDates
              ? 'Start date must not follow end date.'
              : 'Use valid nonnegative amounts, with minimum no greater than maximum.'}
          </p>
        ) : rows.isPending ? (
          <LoadingState text="Loading transactions…" />
        ) : rows.isError ? (
          <p role="alert">
            Could not load transactions.{' '}
            <Button onClick={() => void rows.refetch()}>Retry</Button>
          </p>
        ) : (
          <TransactionTable
            onInspect={setInspecting}
            onCreateRule={setRuleSource}
            rows={rows.data.rows}
            accounts={accounts}
            categories={categories}
            busy={mutation.isPending || rows.isFetching}
            selected={selected}
            onSelect={(id) =>
              setSelected((current) =>
                current.includes(id)
                  ? current.filter((value) => value !== id)
                  : [...current, id],
              )
            }
            onSelectPage={() =>
              setSelected((current) =>
                rows.data.rows.every((row) => current.includes(row.id))
                  ? []
                  : rows.data.rows.map((row) => row.id),
              )
            }
            onEdit={(row) => {
              setEditing(row)
              setCreating(false)
            }}
            onDelete={(row) => {
              if (
                window.confirm(
                  'Delete this transaction? The record will remain in history but will no longer affect balances.',
                )
              )
                mutation.mutate(
                  { path: `/transactions/${row.id}`, method: 'DELETE' },
                  {
                    onSuccess: () => {
                      setEditing(undefined)
                      setOffset(0)
                      setSelected([])
                    },
                  },
                )
            }}
          />
        )}
        {mutation.isError && (
          <p role="alert" className="error">
            {mutation.error.message}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="outline"
            disabled={offset === 0 || rows.isFetching}
            onClick={() => {
              setOffset((o) => Math.max(0, o - 50))
              setSelected([])
            }}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {offset / 50 + 1}
            {rows.data &&
              !invalidRange &&
              ` · ${rows.data.total} matching entries`}
          </span>
          <Button
            variant="outline"
            disabled={
              invalidRange ||
              rows.isFetching ||
              offset + 50 >= (rows.data?.total ?? 0)
            }
            onClick={() => {
              setOffset((o) => o + 50)
              setSelected([])
            }}
          >
            Next
          </Button>
        </div>
      </section>
    </>
  )
}
