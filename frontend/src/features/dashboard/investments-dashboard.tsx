// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 dashboard/dashboard-content.tsx: source composition and layout.
// Thin local projections replace platform valuation/settings hooks.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Plus, List, ArrowLeftRight, ChartNoAxesCombined } from 'lucide-react'
import { request, getDemoDate, localDate } from '@/lib/api'
import { useRoute, navigateTo } from '@/lib/navigation'
import { goalDetailSchema } from '@/lib/wealth-api'
import { decimalUnits, formatDate } from '@/lib/money'
import { t } from '@/lib/i18n'
import { LoadingState, ErrorState } from '@/components/primitives'
import { AccountScopeSelector } from '@/features/holdings/account-filter-selector'
import { ActionPalette } from '@/features/holdings/action-palette'
import { getHoldingsWorkspace } from '@/features/holdings/api'
import { dashboardDates, dashboardDetailContext } from './period'
import { PeriodControls } from './period-controls'
import { getDashboard } from './api'
import { Balance, Gain, Return } from './balance'
import { HistoryChart } from './history-chart'
import { AccountsSummary, TopHoldings, SavingGoals } from './summary-sections'
import '@/features/holdings/i18n'
import './dashboard.css'

export default function InvestmentsDashboard() {
  const route = useRoute()
  const asOf = getDemoDate() || localDate()
  const period = dashboardDates('Investments', route.params, asOf)
  const account = route.accountId || ''
  const [palette, setPalette] = useState(false)
  const setPeriod = (changes: { start: string; end: string; range: string }) =>
    navigateTo('Investments', account || undefined, {
      view: 'Overview',
      ...changes,
    })
  const data = useQuery({
    queryKey: ['dashboard', period.start, period.end, period.range, account],
    queryFn: ({ signal }) =>
      getDashboard(
        period.range === 'ALL' ? null : period.start,
        period.end,
        account,
        signal,
      ),
  })
  const holdings = useQuery({
    queryKey: ['holdings-workspace', account, period.end],
    queryFn: ({ signal }) => getHoldingsWorkspace(account, period.end, signal),
  })
  const goals = useQuery({
    queryKey: ['goals', period.end],
    queryFn: async ({ signal }) =>
      z
        .array(goalDetailSchema)
        .parse(await request(`/goals?as_of=${period.end}`, { signal })),
  })
  const detailContext = dashboardDetailContext('investments', period, account)
  const openHoldings = (asset?: string) =>
    navigateTo('Investments', account || undefined, {
      ...detailContext,
      view: 'Holdings',
      ...(asset ? { asset } : {}),
    })
  const actions = [
    {
      icon: Plus,
      label: t('dashboard_v014:add_activity'),
      onClick: () =>
        navigateTo('Investments', account || undefined, {
          view: 'Activity',
          new: 'true',
          ...detailContext,
        }),
    },
    {
      icon: List,
      label: t('dashboard_v014:holdings'),
      onClick: () => openHoldings(),
    },
    {
      icon: ArrowLeftRight,
      label: t('dashboard_v014:activities'),
      onClick: () =>
        navigateTo('Investments', account || undefined, {
          view: 'Activity',
          ...detailContext,
        }),
    },
    {
      icon: ChartNoAxesCombined,
      label: t('dashboard_v014:performance'),
      onClick: () =>
        navigateTo('Performance', account || undefined, { ...detailContext }),
    },
  ]
  return (
    <section
      className="investment-source-dashboard"
      aria-label={t('dashboard_v014:investments')}
    >
      <div className="dashboard-source-actions">
        <AccountScopeSelector
          value={
            account ? { type: 'account', accountId: account } : { type: 'all' }
          }
          allowMultiAccount={false}
          onChange={(scope) =>
            navigateTo(
              'Investments',
              scope.type === 'account' ? scope.accountId : undefined,
              { view: 'Overview', ...period },
            )
          }
        />
        <ActionPalette
          open={palette}
          onOpenChange={setPalette}
          groups={[{ items: actions }]}
        />
      </div>
      {data.isPending ? (
        <LoadingState />
      ) : data.isError ? (
        <>
          <ErrorState
            text={data.error.message}
            retry={() => void data.refetch()}
          />
          <PeriodControls {...period} asOf={asOf} onChange={setPeriod} />
        </>
      ) : (
        <>
          <div className="px-4 pt-2 pb-1 md:px-6 lg:px-8">
            <Balance
              value={data.data.performance.ending_value}
              currency={data.data.performance.currency}
              sourceLabel={t('dashboard_v014:valued_on', {
                date: formatDate(period.end),
              })}
              sourceDetails={
                <>
                  <p>
                    {t('dashboard_v014:valued_on', {
                      date: formatDate(period.end),
                    })}
                  </p>
                  <p>{t('dashboard_v014:coverage')}</p>
                  <p>
                    {data.data.performance.absolute_gain.reasons.join(' · ')}
                  </p>
                  <p>{data.data.contribution_method}</p>
                </>
              }
            />
            <div className="text-md flex min-h-5 flex-wrap items-center gap-x-3 text-sm font-light">
              <Gain
                value={data.data.performance.absolute_gain.value}
                currency={data.data.performance.currency}
              />
              <div className="border-secondary my-1 self-stretch border-e pe-2" />
              <Return value={data.data.performance.twr.value} />
              <span className="text-muted-foreground ms-1">
                {period.range === 'Custom'
                  ? `${formatDate(period.start)} – ${formatDate(period.end)}`
                  : period.range}
              </span>
            </div>
          </div>
          <div
            className={`dashboard-source-landscape ${data.data.performance.absolute_gain.value && decimalUnits(data.data.performance.absolute_gain.value) < 0n ? 'is-negative' : ''}`}
          >
            <div className="dashboard-hero-chart">
              {data.data.accounts.length ? (
                <HistoryChart
                  points={data.data.points}
                  currency={data.data.performance.currency}
                  period={period.range}
                  label={t('dashboard_v014:portfolio_value')}
                  markers={(
                    data.data.performance.valuation?.purchase_markers || []
                  ).map((m) => ({ date: m.date, label: m.symbol }))}
                />
              ) : (
                <div className="dashboard-chart-empty" role="status">
                  {t('networth:no_history')}
                </div>
              )}
              <PeriodControls {...period} asOf={asOf} onChange={setPeriod} />
            </div>
            <div className="@container grow px-4 pt-14 pb-6 md:px-6 md:pt-12 lg:px-10 lg:pt-14 lg:pb-8">
              <div className="grid grid-cols-1 gap-8 @min-[53rem]:grid-cols-[minmax(0,2fr)_minmax(24rem,1fr)] @min-[53rem]:gap-20">
                <AccountsSummary
                  rows={data.data.accounts}
                  currency={data.data.performance.currency}
                  onOpen={(id) => navigateTo('Account', id, detailContext)}
                />
                <div className="space-y-6">
                  {holdings.isPending ? (
                    <LoadingState />
                  ) : holdings.isError ? (
                    <ErrorState
                      text={holdings.error.message}
                      retry={() => void holdings.refetch()}
                    />
                  ) : (
                    <TopHoldings
                      holdings={holdings.data.rows}
                      onOpen={openHoldings}
                      onViewAll={() => openHoldings()}
                    />
                  )}
                  {goals.isPending ? (
                    <LoadingState />
                  ) : goals.isError ? (
                    <ErrorState
                      text={goals.error.message}
                      retry={() => void goals.refetch()}
                    />
                  ) : (
                    <SavingGoals
                      asOf={period.end}
                      goals={goals.data}
                      onOpen={(goal) =>
                        navigateTo('Goals', undefined, { goal })
                      }
                      onViewAll={() => navigateTo('Goals')}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
