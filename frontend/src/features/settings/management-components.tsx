import { DetailDrawer } from '@/components/detail-drawer'
import { t as tr } from '@/lib/i18n'
import { useState } from 'react'
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

export function Accounts({
  accounts,
  navigate,
}: {
  accounts: Account[]
  navigate: Navigate
}) {
  const [editing, setEditing] = useState<Account>()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const visible = accounts.filter(
    (account) =>
      (status === 'all' || account.active === (status === 'active')) &&
      `${account.name} ${account.institution ?? ''} ${account.currency}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  )
  return (
    <>
      <PageHeader
        title={tr('management:accounts_36bae3')}
        description={tr(
          'management:manage_account_details_and_opening_history__71ba12',
        )}
      >
        <Button
          onClick={() => {
            setEditing(undefined)
            setCreating(!creating)
          }}
        >
          {creating
            ? tr('dynamic:close_form_56adc8')
            : tr('dynamic:add_account_98b0ed')}
        </Button>
      </PageHeader>
      <div className="settings-filter-row">
        <label className="field">
          {tr('settings_v014:accounts')}
          <input
            aria-label={tr('settings_v014:search_accounts')}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="field">
          {tr('settings_v014:status')}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">{tr('settings_v014:all')}</option>
            <option value="active">{tr('settings_v014:active')}</option>
            <option value="inactive">{tr('settings_v014:inactive')}</option>
          </select>
        </label>
      </div>
      {(creating || editing) && (
        <DetailDrawer
          title={editing?.name ?? tr('dynamic:add_account_98b0ed')}
          onClose={() => {
            setEditing(undefined)
            setCreating(false)
          }}
        >
          <AccountForm
            key={editing?.id ?? 'new'}
            account={editing}
            onSaved={() => {
              setEditing(undefined)
              setCreating(false)
            }}
          />
        </DetailDrawer>
      )}
      <Panel
        title={tr('management:all_accounts_6a19f2')}
        detail={tr(
          'management:all_recorded_dates_including_future_entries_and__b7c15e',
        )}
      >
        {!visible.length ? (
          <EmptyState
            title={tr('management:no_accounts_yet_5c5d52')}
            detail={tr(
              'management:add_your_first_account_and_its_optional_opening__9b0f35',
            )}
          />
        ) : (
          <div className="accounts-list">
            <div className="accounts-list-labels" aria-hidden="true">
              <span>{tr('management:account_85dfa3')}</span>
              <span>{tr('management:balance_90eef6')}</span>
              <span />
            </div>
            {visible.map((a) => (
              <div className="account-row" key={a.id}>
                <button
                  className="account-identity"
                  onClick={() => navigate('Account', a.id)}
                  aria-label={tr('messages:message_4c1e7f5e5d70', {
                    value0: a.name,
                  })}
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
                  {!a.active && (
                    <Badge>{tr('management:inactive_09af57')}</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={tr('messages:message_f8d9f06aa37b', {
                    value0: a.name,
                  })}
                  onClick={() => {
                    setEditing(a)
                    setCreating(false)
                  }}
                >
                  {tr('management:edit_530164')}
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="metadata mt-4">
          {tr(
            'management:deactivate_an_account_in_its_editor_history_is_p_9d5718',
          )}
        </p>
      </Panel>
    </>
  )
}

export function CategorySettings({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category>()
  const [creating, setCreating] = useState(false)
  const mutation = useWrite()
  return (
    <>
      <PageHeader
        title={tr('management:categories_6ccb60')}
        description={tr(
          'management:configure_how_you_organize_your_finances__455a72',
        )}
      >
        <Button
          onClick={() => {
            setEditing(undefined)
            setCreating(!creating)
          }}
        >
          {creating
            ? tr('dynamic:close_form_56adc8')
            : tr('dynamic:add_category_d169b7')}
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
        title={tr('management:categories_6ccb60')}
        detail={tr(
          'management:categories_referenced_by_transaction_history_can_691d60',
        )}
      >
        {!categories.length && (
          <EmptyState
            title={tr('management:no_categories_yet_be11fb')}
            detail={tr(
              'management:add_labels_to_organize_your_next_transaction__6bfc59',
            )}
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
                  aria-label={tr('messages:message_f8d9f06aa37b', {
                    value0: c.name,
                  })}
                  onClick={() => {
                    setEditing(c)
                    setCreating(false)
                  }}
                >
                  {tr('management:edit_530164')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  aria-label={tr('messages:message_ea5388f12af2', {
                    value0: c.name,
                  })}
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete category ${c.name}?`))
                      mutation.mutate(
                        { path: `/categories/${c.id}`, method: 'DELETE' },
                        { onSuccess: () => setEditing(undefined) },
                      )
                  }}
                >
                  {tr('management:delete_f6fdbe')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
