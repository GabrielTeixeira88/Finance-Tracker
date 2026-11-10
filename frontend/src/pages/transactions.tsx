import { SpendingTable } from '@/features/activities/spending/spending-table'
import { DeleteTransactionsDialog } from '@/features/activities/spending/delete-transactions-dialog'
import { DetailDrawer } from '@/components/detail-drawer'
import { ActivityEditor } from '@/features/activities/activity-editor'
import { TransactionsFilterBar } from '@/features/activities/spending/transactions-filter-bar'
import { TransactionsBulkBar } from '@/features/activities/spending/transactions-bulk-bar'
import { t as tr } from '@/lib/i18n'
import { useState, useImperativeHandle, type Ref } from 'react'
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
  embedded = false,
  workspaceRef,
}: {
  accounts: Account[]
  categories: Category[]
  initialFilters?: Record<string, string>
  account?: Account
  embedded?: boolean
  workspaceRef?: Ref<{ openAddForm: () => void }>
}) {
  const [ruleSource, setRuleSource] = useState<Transaction>()
  const [editing, setEditing] = useState<Transaction>()
  const [inspecting, setInspecting] = useState<Transaction>()
  const [draft, setDraft] = useState<Transaction>()
  const [deleting, setDeleting] = useState<Transaction>()
  const LedgerTable = embedded ? SpendingTable : TransactionTable
  const Drawer = embedded ? ActivityEditor : DetailDrawer
  const BulkActions = embedded ? TransactionsBulkBar : BulkTransactionActions
  const [creating, setCreating] = useState(false)
  useImperativeHandle(
    workspaceRef,
    () => ({
      openAddForm: () => {
        setEditing(undefined)
        setDraft(undefined)
        setCreating(true)
      },
    }),
    [],
  )
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
      <DeleteTransactionsDialog
        open={deleting !== undefined}
        count={1}
        preview={
          deleting
            ? {
                activityType: deleting.transaction_type,
                amount: deleting.amount,
                currency: deleting.currency,
              }
            : undefined
        }
        isPending={mutation.isPending}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting)
            mutation.mutate(
              { path: `/transactions/${deleting.id}`, method: 'DELETE' },
              {
                onSuccess: () => {
                  setDeleting(undefined)
                  setEditing(undefined)
                  setOffset(0)
                  setSelected([])
                },
              },
            )
        }}
      />
      {inspecting && (
        <TransactionSources
          row={inspecting}
          onClose={() => setInspecting(undefined)}
        />
      )}
      {!embedded && (
        <PageHeader
          title={account?.name ?? tr('dynamic:transactions_1e3281')}
          description={
            account
              ? `${label(account.type)} · ${account.currency}${account.active ? '' : ' · Inactive'}`
              : tr(
                  'dynamic:your_financial_ledger_transfers_stay_separate_fr_ef279b',
                )
          }
        >
          <Button
            onClick={() => {
              setEditing(undefined)
              setDraft(undefined)
              setCreating(!creating)
            }}
          >
            {creating
              ? tr('dynamic:close_form_56adc8')
              : tr('dynamic:_add_transaction_d1583a')}
          </Button>
        </PageHeader>
      )}
      {account && !embedded && (
        <div className="account-detail-strip">
          <span className="metadata">
            {tr('transactions:calculated_balance_all_recorded_dates_57ff7d')}
          </span>
          <Money value={account.balance} currency={account.currency} />
          <span className="metadata">
            {account.institution ?? tr('dynamic:no_institution_cc8c5e')}
          </span>
        </div>
      )}
      {ruleSource && (
        <Drawer
          title={tr('rules:transaction_rules_eafa08')}
          onClose={() => setRuleSource(undefined)}
        >
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
        </Drawer>
      )}
      {creating && (
        <Drawer
          title={tr('dynamic:_add_transaction_d1583a')}
          onClose={() => setCreating(false)}
        >
          <TransactionComposer
            native={embedded}
            key={draft?.id ?? 'new'}
            initialDraft={draft}
            accounts={accounts}
            categories={categories}
            onSaved={() => {
              setCreating(false)
              setOffset(0)
            }}
          />
        </Drawer>
      )}
      {editing && (
        <Drawer
          title={editing.description}
          onClose={() => setEditing(undefined)}
        >
          {editing &&
          !['INCOME', 'EXPENSE'].includes(editing.transaction_type) ? (
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
        </Drawer>
      )}
      <section className={embedded ? 'space-y-3' : 'panel'}>
        <h2 className={embedded ? 'sr-only' : undefined}>
          {tr('transactions:transaction_history_aa7d3d')}
        </h2>
        {(filters.spending_only ||
          filters.uncategorized ||
          filters.payee_id ||
          filters.currency) && (
          <p className="metadata">
            {' '}
            {tr('transactions:spending_drill_down__fbe771')} {filters.currency}{' '}
            {filters.uncategorized ? tr('dynamic:_uncategorized_21dbf0') : ''}{' '}
            {tr('transactions:_linked_refunds_reduce_spending__159121')}{' '}
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
              {tr('transactions:clear_drill_down_filters_45329f')}
            </Button>
          </p>
        )}
        {embedded ? (
          <TransactionsFilterBar
            filters={filters}
            accounts={accounts}
            categories={categories}
            account={account}
            onChange={filter}
            onClear={() => {
              const next: Record<string, string> = account
                ? { account_id: account.id }
                : {}
              setFilters(next)
              rememberLedgerFilters(next)
              setOffset(0)
              setSelected([])
            }}
          />
        ) : (
          <div className="filter-bar">
            <Field label={tr('transactions:search_transactions_f6d97d')}>
              <input
                type="search"
                maxLength={500}
                placeholder={tr(
                  'transactions:description_merchant_or_payee_1579d6',
                )}
                value={filters.search ?? ''}
                onChange={(e) => filter('search', e.target.value)}
              />
            </Field>
            <Field label={tr('transactions:filter_account_b31a18')}>
              <select
                disabled={!!account}
                value={filters.account_id ?? ''}
                onChange={(e) => filter('account_id', e.target.value)}
              >
                <option value="">
                  {tr('transactions:all_accounts_6a19f2')}
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr('transactions:filter_type_60c8f1')}>
              <select
                value={filters.transaction_type ?? ''}
                onChange={(e) => filter('transaction_type', e.target.value)}
              >
                <option value="">{tr('transactions:all_types_30c8a0')}</option>
                {transactionTypes.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr('transactions:filter_category_41feed')}>
              <select
                value={filters.category_id ?? ''}
                onChange={(e) => filter('category_id', e.target.value)}
              >
                <option value="">
                  {tr('transactions:all_categories_060be0')}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
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
            {tr(
              'transactions:more_filters_dates_review_bank_status_and_amount_344b3c',
            )}
          </summary>
          <div className="filter-bar">
            <Field label={tr('transactions:from_date_3b5d11')}>
              <input
                type="date"
                value={filters.date_from ?? ''}
                onChange={(e) => filter('date_from', e.target.value)}
              />
            </Field>
            <Field label={tr('transactions:to_date_af244d')}>
              <input
                type="date"
                value={filters.date_to ?? ''}
                onChange={(e) => filter('date_to', e.target.value)}
              />
            </Field>
            <Field label={tr('transactions:filter_review_1df629')}>
              <select
                value={filters.review_status ?? ''}
                onChange={(e) => filter('review_status', e.target.value)}
              >
                <option value="">
                  {tr('transactions:all_review_states_9a6241')}
                </option>
                <option value="NEEDS_REVIEW">
                  {tr('transactions:needs_review_33a506')}
                </option>
                <option value="REVIEWED">
                  {tr('transactions:reviewed_31ef85')}
                </option>
              </select>
            </Field>
            <Field label={tr('transactions:bank_status_03c91a')}>
              <select
                value={filters.clearing_status ?? ''}
                onChange={(e) => filter('clearing_status', e.target.value)}
              >
                <option value="">
                  {tr('transactions:all_bank_states_a20599')}
                </option>
                <option value="UNCLEARED">
                  {tr('transactions:uncleared_7e9161')}
                </option>
                <option value="CLEARED">
                  {tr('transactions:cleared_a5654a')}
                </option>
                <option value="RECONCILED">
                  {tr('transactions:reconciled_e6c704')}
                </option>
              </select>
            </Field>
            <Field label={tr('transactions:minimum_amount_8c44f9')}>
              <input
                inputMode="decimal"
                value={filters.amount_min ?? ''}
                onChange={(e) => filter('amount_min', e.target.value)}
              />
            </Field>
            <Field label={tr('transactions:maximum_amount_924bc6')}>
              <input
                inputMode="decimal"
                value={filters.amount_max ?? ''}
                onChange={(e) => filter('amount_max', e.target.value)}
              />
            </Field>
            <Field label={tr('transactions:sort_transactions_7ac775')}>
              <select
                value={filters.sort ?? 'date_desc'}
                onChange={(e) => filter('sort', e.target.value)}
              >
                <option value="date_desc">
                  {tr('transactions:newest_first_f5ec77')}
                </option>
                <option value="date_asc">
                  {tr('transactions:oldest_first_6a99c6')}
                </option>
              </select>
            </Field>
          </div>
        </details>
        <p className="metadata">
          {tr(
            'transactions:amount_filters_use_positive_magnitudes_in_each_r_1bad54',
          )}
        </p>
        {selected.length > 0 && !invalidRange && !rows.isError && rows.data && (
          <BulkActions
            onClear={() => setSelected([])}
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
              ? tr('dynamic:start_date_must_not_follow_end_date__89fe31')
              : tr(
                  'dynamic:use_valid_nonnegative_amounts_with_minimum_no_gr_650a4c',
                )}
          </p>
        ) : rows.isPending ? (
          <LoadingState
            text={tr('transactions:loading_transactions__08d0e4')}
          />
        ) : rows.isError ? (
          <p role="alert">
            {' '}
            {tr('transactions:could_not_load_transactions__4bd4ed')}{' '}
            <Button onClick={() => void rows.refetch()}>
              {tr('transactions:retry_9f5cd8')}
            </Button>
          </p>
        ) : (
          <LedgerTable
            {...(embedded
              ? { pageOffset: offset, pageTotal: rows.data.total }
              : {})}
            onDuplicate={(row: Transaction) => {
              setDraft(row)
              setEditing(undefined)
              setCreating(true)
            }}
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
              if (embedded) {
                setDeleting(row)
                return
              }
              if (
                window.confirm(
                  tr(
                    'dynamic:delete_this_transaction_the_record_will_remain_i_394bff',
                  ),
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
            {tr('transactions:previous_50f942')}
          </Button>
          <span className="text-sm">
            {' '}
            {tr('transactions:page_fb0627')} {offset / 50 + 1}
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
            {tr('transactions:next_bc9819')}
          </Button>
        </div>
      </section>
    </>
  )
}
