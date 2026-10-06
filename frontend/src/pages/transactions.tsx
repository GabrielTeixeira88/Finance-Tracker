import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field, TransactionForm } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { TransactionTable } from '@/components/transaction-table'
import { PageHeader, Money, LoadingState } from '@/components/primitives'
import { useWrite } from '@/lib/use-write'
import {
  getTransactions,
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
}: {
  accounts: Account[]
  categories: Category[]
  account?: Account
}) {
  const [editing, setEditing] = useState<Transaction>()
  const [creating, setCreating] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>(
    account ? { account_id: account.id } : {},
  )
  const [offset, setOffset] = useState(0)
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  )
  params.set('limit', '50')
  params.set('offset', String(offset))
  const invalidRange = !!(
    filters.date_from &&
    filters.date_to &&
    filters.date_from > filters.date_to
  )
  const rows = useQuery({
    queryKey: ['transactions', params.toString()],
    queryFn: ({ signal }) => getTransactions(params, signal),
    enabled: !invalidRange,
  })
  const mutation = useWrite()
  function filter(key: string, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setOffset(0)
  }
  return (
    <>
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
          {creating ? 'Close form' : 'Add transaction'}
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
      {(creating || editing) && (
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
      )}
      <section className="panel">
        <h2>Transaction history</h2>
        <div className="filter-bar">
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
        </div>
        {invalidRange ? (
          <p role="alert">Start date must not follow end date.</p>
        ) : rows.isPending ? (
          <LoadingState text="Loading transactions…" />
        ) : rows.isError ? (
          <p role="alert">
            Could not load transactions.{' '}
            <Button onClick={() => void rows.refetch()}>Retry</Button>
          </p>
        ) : (
          <TransactionTable
            rows={rows.data}
            accounts={accounts}
            categories={categories}
            busy={mutation.isPending}
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
            onClick={() => setOffset((o) => Math.max(0, o - 50))}
          >
            Previous
          </Button>
          <span className="text-sm">Page {offset / 50 + 1}</span>
          <Button
            variant="outline"
            disabled={
              invalidRange || rows.isFetching || (rows.data?.length ?? 0) < 50
            }
            onClick={() => setOffset((o) => o + 50)}
          >
            Next
          </Button>
        </div>
      </section>
    </>
  )
}
