import { useState } from 'react'
import { useSection } from '@/lib/navigation'
import { SectionNavigation } from '@/components/section-navigation'
import { ArrowUpRight, Landmark } from 'lucide-react'
import { AccountForm, CategoryForm } from '@/components/forms'
import {
  Badge,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  Panel,
} from '@/components/primitives'
import { Button } from '@/components/ui/button'
import type { Navigate } from '@/components/app-shell'
import { useWrite } from '@/lib/use-write'
import { label, type Account, type Category } from '@/lib/api'
import { Rules } from '@/pages/rules'
import { MarketDataSettings } from '@/pages/market-data'
import { GmailSettings } from '@/pages/gmail'
import { PayeeSettings } from '@/pages/payees'

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
        detail="All recorded dates, including future entries and opening balances. Investment balances show cash; open the account for securities."
      >
        {!accounts.length ? (
          <EmptyState
            title="No accounts yet"
            detail="Add your first account and its optional opening balance."
          />
        ) : (
          <div className="accounts-list">
            <div className="accounts-list-labels" aria-hidden="true">
              <span>Account</span>
              <span>Balance</span>
              <span />
            </div>
            {accounts.map((a) => (
              <div className="account-row" key={a.id}>
                <button
                  className="account-identity"
                  onClick={() => navigate('Account', a.id)}
                  aria-label={`Open ${a.name}`}
                >
                  <span className="account-icon">
                    <Landmark size={19} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {label(a.type)} · {a.currency}
                      {a.institution && ` · ${a.institution}`}
                    </small>
                  </span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
                <div className="account-value">
                  <Money
                    value={a.balance}
                    currency={a.currency}
                    tone={a.balance.startsWith('-') ? 'negative' : 'neutral'}
                  />
                  {!a.active && <Badge>Inactive</Badge>}
                </div>
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
              </div>
            ))}
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

export function Settings({
  categories,
  accounts,
}: {
  categories: Category[]
  accounts: Account[]
}) {
  const items = [
    ['categories', 'Categories'],
    ['payees', 'Payees'],
    ['rules', 'Rules'],
    ['market', 'Market Data'],
    ['gmail', 'Gmail'],
  ] as const
  const [view, setView] = useSection(
    items.map(([key]) => key),
    'categories',
  )
  return (
    <>
      <SectionNavigation
        label="Settings sections"
        items={items}
        value={view}
        onChange={setView}
      />
      {view === 'categories' ? (
        <CategorySettings categories={categories} />
      ) : view === 'payees' ? (
        <PayeeSettings />
      ) : view === 'market' ? (
        <MarketDataSettings />
      ) : view === 'gmail' ? (
        <GmailSettings accounts={accounts} />
      ) : (
        <>
          <PageHeader title="Settings" description="Transaction automation" />
          <Rules accounts={accounts} categories={categories} />
        </>
      )}
    </>
  )
}

function CategorySettings({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category>()
  const [creating, setCreating] = useState(false)
  const mutation = useWrite()
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure how you organize your finances."
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
        title="Categories"
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
                  variant="destructive"
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
