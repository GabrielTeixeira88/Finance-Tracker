import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight } from 'lucide-react'
import { AccountForm, CategoryForm, TransferForm } from '@/components/forms'
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
  Panel,
} from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { TransactionTable } from '@/components/transaction-table'
import type { Navigate } from '@/components/app-shell'
import { useWrite } from '@/lib/use-write'
import { getTransactions, label, type Account, type Category } from '@/lib/api'

export function Accounts({
  accounts,
  navigate,
}: {
  accounts: Account[]
  navigate: Navigate
}) {
  const [editing, setEditing] = useState<Account>()
  const [creating, setCreating] = useState(false)
  return (
    <>
      <PageHeader
        title="Accounts"
        description="Manage account details and opening history."
      >
        <Button
          onClick={() => {
            setEditing(undefined)
            setCreating(!creating)
          }}
        >
          {creating ? 'Close form' : 'Add account'}
        </Button>
      </PageHeader>
      {(creating || editing) && (
        <AccountForm
          key={editing?.id ?? 'new'}
          account={editing}
          onSaved={() => {
            setEditing(undefined)
            setCreating(false)
          }}
        />
      )}
      <Panel
        title="All accounts"
        detail="Balances are calculated from your ledger, including opening entries."
      >
        {!accounts.length ? (
          <EmptyState
            title="No accounts yet"
            detail="Add your first account and its optional opening balance."
          />
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Accounts table"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Type</th>
                  <th scope="col">Institution</th>
                  <th scope="col">Status</th>
                  <th scope="col">Currency</th>
                  <th scope="col" className="amount-cell">
                    Balance
                  </th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <th scope="row">
                      <button
                        className="text-action"
                        onClick={() => navigate('Account', a.id)}
                      >
                        {a.name}
                      </button>
                    </th>
                    <td className="capitalize">{label(a.type)}</td>
                    <td>{a.institution ?? '—'}</td>
                    <td>
                      <Badge>{a.active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td>{a.currency}</td>
                    <td className="amount-cell">
                      <Money
                        value={a.balance}
                        currency={a.currency}
                        tone={
                          a.balance.startsWith('-') ? 'negative' : 'neutral'
                        }
                      />
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Edit ${a.name}`}
                        onClick={() => {
                          setEditing(a)
                          setCreating(false)
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="metadata mt-4">
          Deactivate an account in its editor. History is preserved. Currency
          and opening entries cannot be edited.
        </p>
      </Panel>
    </>
  )
}

export function Categories({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category>()
  const [creating, setCreating] = useState(false)
  const mutation = useWrite()
  return (
    <>
      <PageHeader
        title="Categories"
        description="Simple labels for income and expenses."
      >
        <Button
          onClick={() => {
            setEditing(undefined)
            setCreating(!creating)
          }}
        >
          {creating ? 'Close form' : 'Add category'}
        </Button>
      </PageHeader>
      {(creating || editing) && (
        <CategoryForm
          key={editing?.id ?? 'new'}
          category={editing}
          onSaved={() => {
            setEditing(undefined)
            setCreating(false)
          }}
        />
      )}
      {mutation.isError && <ErrorState text={mutation.error.message} />}
      <Panel
        title="Your categories"
        detail="Categories referenced by transaction history cannot be deleted."
      >
        {!categories.length && (
          <EmptyState
            title="No categories yet"
            detail="Add labels to organize your next transaction."
          />
        )}
        <div className="category-list">
          {categories.map((c) => (
            <div className="category-row" key={c.id}>
              <span>{c.name}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => {
                    setEditing(c)
                    setCreating(false)
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Delete ${c.name}`}
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete category ${c.name}?`))
                      mutation.mutate(
                        { path: `/categories/${c.id}`, method: 'DELETE' },
                        { onSuccess: () => setEditing(undefined) },
                      )
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}

export function Transfers({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const recent = useQuery({
    queryKey: ['transactions', 'transfers'],
    queryFn: ({ signal }) =>
      getTransactions(
        new URLSearchParams({ transaction_type: 'TRANSFER', limit: '20' }),
        signal,
      ),
  })
  return (
    <>
      <PageHeader
        title="Transfers"
        description="Move money between your accounts, without recording income or spending."
      />
      <div className="transfer-layout">
        <TransferForm accounts={accounts} />
        <aside className="transfer-explanation">
          <ArrowLeftRight size={24} aria-hidden="true" />
          <h2>One move. Two linked entries.</h2>
          <p className="metadata">
            The source balance decreases and the destination balance increases
            by the same amount. Your total account value stays the same.
          </p>
          <p className="metadata">
            Choose two active accounts with matching currencies. Transfers
            remain in history and cannot be edited in this phase.
          </p>
        </aside>
      </div>
      <Panel
        title="Recent transfers"
        detail="Latest 20 ledger sides · Matching transfer IDs identify each pair"
      >
        {recent.isPending ? (
          <LoadingState text="Loading transfers…" />
        ) : recent.isError ? (
          <ErrorState
            text="Unable to load transfers."
            retry={() => void recent.refetch()}
          />
        ) : (
          <TransactionTable
            rows={recent.data}
            accounts={accounts}
            categories={categories}
          />
        )}
      </Panel>
    </>
  )
}
