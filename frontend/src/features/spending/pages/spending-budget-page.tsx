import Refunds from '@/pages/spending-refunds'
import { t as translate } from '@/lib/i18n'
import { TargetEditor } from '../components/target-details'
import type { BudgetCategoryRow } from '../types/budget'
import { CategoryAppearance } from '../components/category-appearance'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui'
// SPDX-License-Identifier: AGPL-3.0-only
// Page/header/month controls adapted from Wealthfolio 92b4647 spending-budget-page.tsx.
import '../i18n'
import '../spending.css'
import '../../holdings/migration.css'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import type { Category, Account } from '@/lib/api'
import { useRoute, navigateTo } from '@/lib/navigation'
import { shiftMonth } from '@/lib/budget-api'
import { dayAfter } from '@/lib/spending-period'
import { ErrorState, LoadingState } from '@/components/primitives'
import { PortalScope } from '@/vendor/wealthfolio/ui/components/ui/portal-scope'
import { Page, PageHeader, PageContent, Button, Icons } from '../ui'
import { BudgetEditor } from '../components/budget-editor'
import {
  getBudgetWorkspace,
  sourceBudgetSnapshot,
  useBudgetActions,
  type BudgetWorkspace,
} from '../budget-adapter'
import { getSpendingWorkspace, type SpendingWorkspaceData } from '../api'

export default function SpendingBudgetPage({
  month,
  currency,
  asOf,
  categories,
  accounts,
}: {
  accounts: Account[]
  month: string
  currency: string
  asOf: string
  categories: Category[]
}) {
  const { t } = useTranslation()
  const route = useRoute()
  const mode = route.params.get('setup') === 'true' ? 'setup' : 'monthly'
  const data = useQuery({
    queryKey: ['budgets', 'workspace', month, currency, asOf],
    queryFn: ({ signal }) => getBudgetWorkspace(month, currency, asOf, signal),
  })
  const start = month + '-01'
  const end = shiftMonth(month, 1) + '-01'
  const cutoff = end < dayAfter(asOf) ? end : dayAfter(asOf)
  const income = useQuery({
    queryKey: ['spending-workspace', start, cutoff, currency, asOf],
    queryFn: ({ signal }) =>
      getSpendingWorkspace(start, cutoff, asOf, currency, signal),
    enabled: start < cutoff,
  })
  const change = (values: Record<string, string>) =>
    navigateTo('Budget', undefined, {
      ...Object.fromEntries(route.params),
      view: 'Budgets',
      ...values,
    })
  return (
    <PortalScope name="holdings-migration">
      <section className="wf-workspace wf-spending">
        <Page>
          <PageHeader
            className="spending-page-header"
            heading={t(
              mode === 'setup'
                ? 'wfSpending:budgetEditor.defaultMonthlyPlan'
                : 'wfSpending:budgetPage.heading',
            )}
            text={
              mode === 'setup'
                ? t('spendingMigration:effectiveMonth', { month })
                : t('wfSpending:budgetPage.subheading')
            }
            onBack={() => navigateTo('Budget', undefined, { month })}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <MonthSwitcher
                  monthKey={month}
                  currentMonth={asOf.slice(0, 7)}
                  onChange={(next) => change({ month: next })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    change({ setup: mode === 'setup' ? '' : 'true' })
                  }
                >
                  <Icons.Settings className="me-1.5 h-3.5 w-3.5" />
                  {mode === 'setup'
                    ? t('wfSpending:budgetPage.heading')
                    : t('wfSpending:budgetPage.defaults')}
                </Button>
              </div>
            }
          />
          <PageContent className="space-y-5">
            {data.isError ? (
              <ErrorState
                text={data.error.message}
                retry={() => void data.refetch()}
              />
            ) : data.isPending ? (
              <LoadingState />
            ) : (
              <ConnectedBudgetEditor
                accounts={accounts}
                data={data.data}
                categories={categories}
                mode={mode}
                income={income.data}
              />
            )}
            {income.isError && (
              <ErrorState
                text={income.error.message}
                retry={() => void income.refetch()}
              />
            )}
          </PageContent>
        </Page>
      </section>
    </PortalScope>
  )
}

function ConnectedBudgetEditor({
  data,
  categories,
  mode,
  income,
  accounts,
}: {
  accounts: Account[]
  data: BudgetWorkspace
  categories: Category[]
  mode: 'monthly' | 'setup'
  income?: SpendingWorkspaceData
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<BudgetCategoryRow | 'new' | null>(null)
  const [refundsOpen, setRefundsOpen] = useState(false)
  const actions = useBudgetActions(data, mode)
  const snapshot = useMemo(
    () => sourceBudgetSnapshot(data, categories, mode, income),
    [data, categories, mode, income],
  )
  return (
    <>
      {actions.error && <ErrorState text={actions.error.message} />}
      <Button variant="ghost" size="sm" onClick={() => setRefundsOpen(true)}>
        {translate('spending:refunds_be32ad')}
      </Button>
      <Dialog open={refundsOpen} onOpenChange={setRefundsOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{translate('spending:refunds_be32ad')}</DialogTitle>
          </DialogHeader>
          <Refunds
            accounts={accounts}
            currency={data.report.currency}
            month={data.report.month}
          />
        </DialogContent>
      </Dialog>
      <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
        <Icons.Plus className="me-1 h-3 w-3" />
        {t('spendingMigration:addTarget')}
      </Button>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing === 'new'
                ? t('spendingMigration:addTarget')
                : editing?.name}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <>
              <TargetEditor
                key={editing === 'new' ? 'new' : editing.categoryId}
                row={
                  editing === 'new'
                    ? undefined
                    : data.report.categories.find(
                        (row) => row.category_id === editing.categoryId,
                      )
                }
                data={data.report}
                categories={categories}
                onClose={() => setEditing(null)}
              />
              {editing !== 'new' && (
                <CategoryAppearance
                  key={'style-' + editing.categoryId}
                  category={categories.find(
                    (row) => row.id === editing.categoryId,
                  )!}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <BudgetEditor
        budget={snapshot}
        mode={mode}
        periodKey={data.report.month}
        actions={{ ...actions, editDetails: setEditing }}
      />
    </>
  )
}

function MonthSwitcher({
  monthKey,
  currentMonth,
  onChange,
}: {
  monthKey: string
  currentMonth: string
  onChange: (month: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="bg-card/40 border-border/60 inline-flex items-center gap-0.5 rounded-full border px-1 py-0.5 shadow-xs">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="hover:bg-muted/60 h-7 w-7 rounded-full p-0"
        aria-label={t('wfSpending:calendar.previousMonth')}
        disabled={monthKey === '1900-01'}
        onClick={() => onChange(shiftMonth(monthKey, -1))}
      >
        <Icons.ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      </Button>
      <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-1 rounded-full px-2 transition-colors">
        <Icons.Calendar className="text-muted-foreground h-3.5 w-3.5" />
        <input
          type="month"
          value={monthKey}
          min="1900-01"
          max="2199-12"
          aria-label={t('wfSpending:period.selectMonth')}
          onChange={(event) => {
            if (/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(event.target.value))
              onChange(event.target.value)
          }}
          className="text-foreground h-7 w-36 cursor-pointer bg-transparent text-xs outline-none"
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="hover:bg-muted/60 h-7 w-7 rounded-full p-0"
        aria-label={t('wfSpending:calendar.nextMonth')}
        disabled={monthKey === '2199-12'}
        onClick={() => onChange(shiftMonth(monthKey, 1))}
      >
        <Icons.ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </Button>
      {monthKey !== currentMonth && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-muted/60 hover:text-foreground h-7 rounded-full px-2.5 text-xs"
          onClick={() => onChange(currentMonth)}
        >
          {t('wfSpending:period.thisMonth')}
        </Button>
      )}
    </div>
  )
}
