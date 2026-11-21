// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 spending/components/transactions-filter-bar.tsx.
// Native faceted controls retain the local server's combined single-value filters.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { label, transactionTypes, type Account, type Category } from '@/lib/api'
import { FacetedFilter } from '@/vendor/wealthfolio/ui/components/ui/faceted-filter'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/vendor/wealthfolio/ui/components/ui/sheet'
import { Button, Input, Icons } from '../../holdings/ui'
import { useIsMobileViewport } from '../../holdings/compat'

export function TransactionsFilterBar({
  filters,
  accounts,
  categories,
  account,
  onChange,
  onClear,
}: {
  filters: Record<string, string>
  accounts: Account[]
  categories: Category[]
  account?: Account
  onChange: (key: string, value: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const mobile = useIsMobileViewport()
  const active = Object.entries(filters).some(
    ([key, value]) => value && !(account && key === 'account_id'),
  )
  const facet = (
    key: string,
    title: string,
    options: { value: string; label: string }[],
  ) => (
    <FacetedFilter
      title={title}
      options={options}
      selectedValues={new Set(filters[key] ? [filters[key]] : [])}
      onFilterChange={(values) => onChange(key, [...values].at(-1) ?? '')}
    />
  )
  const controls = (
    <>
      {account ? (
        <select
          aria-label={t('transactions:filter_account_b31a18')}
          disabled
          className="text-muted-foreground h-8 max-w-48 rounded-lg border px-2 text-xs"
          value={account.id}
        >
          <option value={account.id}>{account.name}</option>
        </select>
      ) : (
        facet(
          'account_id',
          t('wfActivity:filter_account'),
          accounts.map((row) => ({ value: row.id, label: row.name })),
        )
      )}
      {facet(
        'transaction_type',
        t('wfActivity:filter_type'),
        transactionTypes.map((value) => ({
          value,
          label: t(
            (
              {
                INCOME: 'forms:income_1c89b1',
                EXPENSE: 'forms:expense_a0db8e',
                TRANSFER: 'forms:transfer_cbb4cc',
                OPENING_BALANCE: 'forms:opening_balance_7622a7',
              } as const
            )[value],
          ),
        })),
      )}
      {facet(
        'category_id',
        t('wfSpending:filters.category'),
        categories.map((row) => ({ value: row.id, label: row.name })),
      )}
      {facet(
        'review_status',
        t('transactions:filter_review_1df629'),
        ['REVIEWED', 'NEEDS_REVIEW'].map((value) => ({
          value,
          label: label(value),
        })),
      )}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground h-8 px-2 text-xs"
        >
          {t('wfSpending:filters.clearAll')}
        </Button>
      )}
    </>
  )
  return (
    <div className="-mx-1 flex flex-wrap items-center gap-2 px-1 pb-1">
      <Input
        type="search"
        aria-label={t('transactions:search_transactions_f6d97d')}
        value={filters.search ?? ''}
        onChange={(event) => onChange('search', event.target.value)}
        placeholder={t('transactions:description_merchant_or_payee_1579d6')}
        maxLength={500}
        className={
          mobile
            ? 'bg-secondary/30 h-10 min-w-0 flex-1 rounded-full border-none'
            : 'h-8 w-40 lg:w-60'
        }
      />
      {mobile ? (
        <>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label={t('wfSpending:filters.filterTransactions')}
            onClick={() => setOpen(true)}
          >
            <Icons.ListFilter className="size-4" />
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent
              side="bottom"
              className="wf-workspace wf-editor mx-1 flex max-h-[80dvh] flex-col rounded-t-4xl p-0"
            >
              <SheetHeader className="border-b px-6 py-4">
                <SheetTitle>
                  {t('wfSpending:filters.filterTransactions')}
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-wrap gap-2 overflow-y-auto px-6 py-4">
                {controls}
              </div>
              <SheetFooter className="border-t px-6 py-4">
                <Button onClick={() => setOpen(false)}>
                  {t('wfSpending:filters.done')}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        controls
      )}
    </div>
  )
}
