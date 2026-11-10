// SPDX-License-Identifier: AGPL-3.0-only
// AccountPage layout adapted from Wealthfolio 92b4647 pages/account/account-page.tsx
// and account-metrics.tsx. Ledger-authoritative history replaces snapshots/balance overrides.
import './i18n'
import './migration.css'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import {
  getDemoDate,
  localDate,
  request,
  label,
  type Account,
  type Category,
} from '@/lib/api'
import { getAssets } from '@/lib/investments'
import { marketHistorySchema } from '@/lib/market-data'
import { startDate } from '@/lib/investment-analytics'
import { useRoute, updateRouteParams, navigateTo } from '@/lib/navigation'
import { backToDashboard } from '@/features/dashboard/period'
import { AccountForm, TransactionComposer } from '@/components/forms'
import { ActivityForm } from '@/pages/investment-forms'
import { ErrorState, LoadingState } from '@/components/primitives'
import { PortfolioValueChart } from '@/components/portfolio-value-chart'
import Transactions from '@/pages/transactions'
import Reconciliation from '@/pages/reconciliation'
import { InvestmentActivities } from '../activities/investment-activities'
import { HoldingsTable } from './holdings-table'
import { HoldingsTableMobile } from './holdings-table-mobile'
import { getHoldingsWorkspace } from './api'
import { filterHoldingsByVisibility } from './holdings-visibility'
import { exactSubtract, useBalancePrivacy } from './compat'
import { ActionPalette } from './action-palette'
import {
  Page,
  PageHeader,
  PageContent,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  AmountDisplay,
  Button,
  AnimatedToggleGroup,
  Icons,
  Input,
} from './ui'
import { PortalScope } from '@/vendor/wealthfolio/ui/components/ui/portal-scope'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/vendor/wealthfolio/ui/components/ui/dialog'

const exact = z.string().regex(/^-?\d+(\.\d+)?$/)
const schema = z.object({
  account_id: z.string(),
  currency: z.string(),
  start: z.string(),
  end: z.string(),
  cash: exact,
  value: exact.nullable(),
  history: marketHistorySchema,
  summary: z
    .object({
      market_value: exact.nullable(),
      cost_basis: exact,
      realized: exact,
      income: exact,
    })
    .nullable(),
})
const ranges = ['1M', '3M', '6M', '1Y', 'ALL'] as const
export default function AccountProfilePage({
  account,
  accounts,
  categories,
  initialFilters,
}: {
  account: Account
  accounts: Account[]
  categories: Category[]
  initialFilters?: Record<string, string>
}) {
  const { t } = useTranslation()
  const route = useRoute()
  const { isBalanceHidden } = useBalancePrivacy()
  const investment = account.type === 'INVESTMENT'
  const end = route.params.get('end') || getDemoDate() || localDate()
  const range =
    ranges.find((value) => value === route.params.get('range')) ?? '3M'
  const start = route.params.get('start') || startDate(range, end, '')
  const [palette, setPalette] = useState(false)
  const [editing, setEditing] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [closed, setClosed] = useState(false)
  const [adding, setAdding] = useState(false)
  const rows = useQuery({
    queryKey: ['account-workspace', account.id, start, end],
    queryFn: async ({ signal }) =>
      schema.parse(
        await request(
          `/accounts/${account.id}/workspace?${new URLSearchParams({ start, end })}`,
          { signal },
        ),
      ),
  })
  const securities = useQuery({
    queryKey: ['investments', 'assets'],
    queryFn: getAssets,
    enabled: investment,
  })
  const holdings = useQuery({
    queryKey: ['holdings-workspace', account.id, end],
    queryFn: ({ signal }) => getHoldingsWorkspace(account.id, end, signal),
    enabled: investment,
  })
  const params = (changes: Record<string, string>) =>
    updateRouteParams(
      new URLSearchParams({ ...Object.fromEntries(route.params), ...changes }),
    )
  const views = investment
    ? ['holdings', 'activities', 'cash']
    : ['activities', 'reconciliation']
  const tab =
    !investment && route.params.get('view') === 'reconciliation'
      ? 'reconciliation'
      : views.includes(route.params.get('account_tab') ?? '')
        ? route.params.get('account_tab')!
        : views[0]
  const summary = rows.data?.summary
  const entries = [
    { label: t('wfAccount:cash_balance'), value: rows.data?.cash ?? null },
    ...(investment
      ? [
          {
            label: t('wfAccount:investments'),
            value: summary?.market_value ?? null,
          },
          {
            label: t('wfAccount:cost_basis'),
            value: summary?.cost_basis ?? null,
          },
          {
            label: t('wfAccount:unrealized_pnl'),
            value: exactSubtract(
              summary?.market_value ?? null,
              summary?.cost_basis ?? null,
            ),
          },
          {
            label: t('wfHoldings:realized_pnl'),
            value: summary?.realized ?? null,
          },
          { label: t('wfHoldings:income'), value: summary?.income ?? null },
        ]
      : []),
  ]
  const all = holdings.data?.rows ?? []
  const visible = filterHoldingsByVisibility(all, [closed ? 'closed' : 'open'])
  return (
    <PortalScope name="holdings-migration">
      <section className="wf-workspace">
        <Page>
          <PageHeader
            onBack={() =>
              backToDashboard(route.params, route.accountId) ||
              navigateTo('Accounts')
            }
            actions={
              <ActionPalette
                open={palette}
                onOpenChange={setPalette}
                groups={[
                  {
                    items: [
                      {
                        icon: Icons.Plus,
                        label: t('wfActivity:add_transaction'),
                        onClick: () => setAdding(true),
                      },
                      {
                        icon: Icons.Pencil,
                        label: t('wfAccount:edit_account'),
                        onClick: () => setEditing(true),
                      },
                      {
                        icon: Icons.Import,
                        label: t('wfCommon:import'),
                        onClick: () =>
                          navigateTo(
                            investment ? 'Investments' : 'Transactions',
                            account.id,
                            { view: investment ? 'Imports' : 'imports' },
                          ),
                      },
                    ],
                  },
                ]}
              />
            }
          >
            <div className="flex min-w-0 items-center gap-3">
              <Icons.Wallet className="size-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <h1 id="page-title" className="truncate text-xl font-semibold">
                  {account.name}
                </h1>
                <div className="text-muted-foreground flex flex-wrap gap-1.5 text-xs md:text-sm">
                  <span>{label(account.type)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{account.currency}</span>
                  {account.institution && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{account.institution}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </PageHeader>
          <PageContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 pt-0 lg:grid-cols-3">
                <Card className="col-span-1 overflow-hidden lg:col-span-2">
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {t('wfAccount:total_value')}
                      </CardTitle>
                      <div className="pt-2 text-2xl font-bold">
                        <AmountDisplay
                          value={rows.data?.value ?? null}
                          currency={account.currency}
                          isHidden={isBalanceHidden}
                        />
                      </div>
                      <p className="text-muted-foreground pt-1 text-xs">
                        {start} — {end}
                      </p>
                    </div>
                    <label className="text-muted-foreground text-xs">
                      {t('investments:valuation_as_of_58c88f')}
                      <Input
                        type="date"
                        value={end}
                        max={localDate()}
                        onChange={(event) =>
                          event.target.value &&
                          params({ end: event.target.value })
                        }
                        className="mt-1 h-8 w-36"
                      />
                    </label>
                  </CardHeader>
                  <CardContent className="p-0">
                    {rows.isPending ? (
                      <LoadingState />
                    ) : rows.isError ? (
                      <ErrorState
                        text={rows.error.message}
                        retry={() => void rows.refetch()}
                      />
                    ) : rows.data.history.points.some(
                        (p) => p.value !== null,
                      ) ? (
                      <PortfolioValueChart
                        history={rows.data.history}
                        mode={investment ? 'market' : 'ledger'}
                        label={t('wfAccount:total_value')}
                      />
                    ) : (
                      <p
                        role="status"
                        className="text-muted-foreground p-6 text-sm"
                      >
                        {t('parity:history_unavailable')}
                      </p>
                    )}
                    <div className="flex justify-center pb-4">
                      <AnimatedToggleGroup
                        items={ranges.map((value) => ({ value, label: value }))}
                        value={range}
                        onValueChange={(value) =>
                          params({
                            range: value,
                            start: startDate(value, end, ''),
                          })
                        }
                        size="sm"
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t('wfAccount:account_details')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {entries.map((entry) => (
                      <div
                        key={entry.label}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="text-muted-foreground">
                          {entry.label}
                        </span>
                        <AmountDisplay
                          value={entry.value}
                          currency={account.currency}
                          isHidden={isBalanceHidden}
                        />
                      </div>
                    ))}
                    <p className="text-muted-foreground border-t pt-3 text-xs">
                      {t(
                        'management:manage_account_details_and_opening_history__71ba12',
                      )}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      {t('wfAccount:edit_account')}
                    </Button>
                  </CardContent>
                </Card>
              </div>
              <AnimatedToggleGroup
                value={tab}
                onValueChange={(value) => params({ account_tab: value })}
                size="sm"
                items={views.map((value) => ({
                  value,
                  label: t(
                    value === 'holdings'
                      ? 'wfAccount:holdings'
                      : value === 'cash'
                        ? 'wfAccount:cash_balance'
                        : value === 'reconciliation'
                          ? 'labels:reconcile'
                          : 'wfActivity:activities',
                  ),
                }))}
              />
              {tab === 'holdings' && (
                <>
                  {holdings.isError && (
                    <ErrorState
                      text={holdings.error.message}
                      retry={() => void holdings.refetch()}
                    />
                  )}
                  <div className="hidden md:block">
                    <HoldingsTable
                      holdings={visible}
                      isLoading={holdings.isPending}
                      visibilityFilters={[closed ? 'closed' : 'open']}
                      setVisibilityFilters={(values) =>
                        setClosed(values[0] === 'closed')
                      }
                    />
                  </div>
                  <div className="md:hidden">
                    <HoldingsTableMobile
                      holdings={visible}
                      isLoading={holdings.isPending}
                      selectedTypes={selectedTypes}
                      setSelectedTypes={setSelectedTypes}
                      accountFilter={{ type: 'account', accountId: account.id }}
                      onAccountScopeChange={() => {}}
                      accounts={accounts}
                      portfolios={[]}
                      visibilityFilters={[closed ? 'closed' : 'open']}
                      setVisibilityFilters={(values) =>
                        setClosed(values[0] === 'closed')
                      }
                    />
                  </div>
                </>
              )}
              {tab === 'activities' &&
                (investment ? (
                  securities.isError ? (
                    <ErrorState
                      text={securities.error.message}
                      retry={() => void securities.refetch()}
                    />
                  ) : securities.isPending ? (
                    <LoadingState />
                  ) : (
                    <InvestmentActivities
                      lockedScope
                      accountId={account.id}
                      assetId=""
                      accounts={accounts}
                      assets={securities.data}
                    />
                  )
                ) : (
                  <Transactions
                    embedded
                    initialFilters={initialFilters}
                    account={account}
                    accounts={accounts}
                    categories={categories}
                  />
                ))}
              {tab === 'cash' && (
                <Transactions
                  embedded
                  initialFilters={initialFilters}
                  account={account}
                  accounts={accounts}
                  categories={categories}
                />
              )}
              {tab === 'reconciliation' && (
                <Reconciliation
                  account={account}
                  accounts={accounts}
                  categories={categories}
                />
              )}
            </div>
          </PageContent>
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogContent className="wf-workspace wf-editor max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('wfAccount:edit_account')}</DialogTitle>
              </DialogHeader>
              <AccountForm
                account={account}
                onSaved={() => setEditing(false)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={adding} onOpenChange={setAdding}>
            <DialogContent className="wf-workspace wf-editor max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('wfActivity:add_transaction')}</DialogTitle>
              </DialogHeader>
              {investment ? (
                <ActivityForm
                  native
                  accounts={accounts}
                  assets={securities.data ?? []}
                  initialAccount={account.id}
                  blockedAssetIds={all
                    .filter((row) => row.contract)
                    .map((row) => row.instrument?.id ?? '')}
                  onSaved={() => setAdding(false)}
                />
              ) : (
                <TransactionComposer
                  native
                  accounts={accounts}
                  categories={categories}
                  initialAccount={account.id}
                  onSaved={() => setAdding(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        </Page>
      </section>
    </PortalScope>
  )
}
