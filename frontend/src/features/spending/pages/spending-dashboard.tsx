// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 spending-tab-content.tsx: source hero, chart and responsive dashboard composition.
// Queries/classification/normalization are Finance Tracker adapters. All financial labels retain exact API strings.
import '../i18n'
import '../spending.css'
import '../../holdings/migration.css'
import { useId, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { getTransactions, type Account, type Category } from '@/lib/api'
import {
  decimalUnits,
  unitsToMoney,
  sumMoney,
  formatExactPercent,
} from '@/lib/money'
import { shiftMonth, type BudgetReport } from '@/lib/budget-api'
import { navigateTo, useRoute } from '@/lib/navigation'
import { useMotionPolicy } from '@/lib/motion'
import { ErrorState, LoadingState } from '@/components/primitives'
import { PrivacyToggle } from '../components/privacy-toggle'
import { PortalScope } from '@/vendor/wealthfolio/ui/components/ui/portal-scope'
import { useSpendingPeriod, activityHref } from '../period-adapter'
import { Link, useBalancePrivacy } from '../compat'
import { PrivacyAmount, Icons } from '../ui'
import { SpendingDeltaLine } from '../components/spending-delta-line'
import { CashFlowStrip } from '../components/cash-flow-strip'
import { SpendingPeriodSelector } from '../components/spending-period-toggle'
import {
  CategoryRankedBar,
  CategoryTreemapMono,
  SegmentedToggle,
} from '../components/category-breakdown'
import { DashboardCard } from '../components/dashboard-card'
import { RecentActivityCard } from '../components/recent-activity-card'
import { BudgetLineChartCard } from '../components/budget-line-chart-card'
import { EventsCard } from '../components/events-card'
import { getBudgetWorkspace, sourceBudgetSnapshot } from '../budget-adapter'

export default function SpendingDashboard({
  asOf,
  currency,
  categories,
  accounts,
  budgetReport,
}: {
  asOf: string
  currency: string
  categories: Category[]
  accounts: Account[]
  budgetReport: BudgetReport
}) {
  const { t } = useTranslation(),
    route = useRoute(),
    reduced = useMotionPolicy(),
    gradient = useId().replace(/:/g, '')
  const { isBalanceHidden } = useBalancePrivacy()
  const { period, selector, data } = useSpendingPeriod(asOf, currency)
  const [view, setView] = useState('list'),
    [grouped, setGrouped] = useState(true)
  const month = budgetReport.month
  const budget = useQuery({
    queryKey: ['budgets', 'workspace', month, currency, asOf],
    queryFn: ({ signal }) => getBudgetWorkspace(month, currency, asOf, signal),
  })
  const filters = {
    spending_only: 'true',
    currency,
    date_from: period.start,
    date_to: period.end,
    limit: '10',
  }
  const recent = useQuery({
    queryKey: ['transactions', 'spending-overview', filters],
    queryFn: ({ signal }) =>
      getTransactions(new URLSearchParams(filters), signal),
  })
  const snapshot = useMemo(
    () =>
      budget.data
        ? sourceBudgetSnapshot(budget.data, categories, 'monthly', data.data)
        : null,
    [budget.data, categories, data.data],
  )
  if (data.isPending) return <LoadingState />
  if (data.isError)
    return (
      <ErrorState text={data.error.message} retry={() => void data.refetch()} />
    )
  const report = data.data
  const rows = report.categories
    .filter((row) => decimalUnits(row.current) !== 0n)
    .map((row) => {
      const meta = categories.find((c) => c.id === row.category_id)
      return {
        id: row.category_id ?? '__uncategorized__',
        name: row.category_id
          ? row.name
          : t('wfSpending:dashboard.uncategorized'),
        amount: row.current,
        color: meta?.color ?? null,
        icon: meta?.icon ?? null,
      }
    })
  const hasNegative = rows.some((row) => decimalUnits(row.amount) < 0n)
  const buckets = new Map<
    string,
    { date: string; end: string; amount: string }
  >()
  const monthly = report.daily.length > 62
  for (const row of report.daily) {
    const key = monthly ? row.date.slice(0, 7) : row.date
    const prior = buckets.get(key)
    buckets.set(key, {
      date: prior?.date ?? row.date,
      end: row.date,
      amount: sumMoney([prior?.amount ?? '0', row.spending]),
    })
  }
  const maximum = [...buckets.values()].reduce((high, row) => {
    const units = decimalUnits(row.amount),
      abs = units < 0n ? -units : units
    return abs > high ? abs : high
  }, 0n)
  const chart = [...buckets].map(([key, row]) => ({
    ...row,
    key,
    label: monthly ? key : row.date.slice(8),
    value: maximum
      ? Number((decimalUnits(row.amount) * 1000000n) / maximum) / 1000000
      : 0,
  }))
  const avg = chart.length
    ? unitsToMoney(decimalUnits(report.current.expenses) / BigInt(chart.length))
    : '0'
  const avgCoordinate = maximum
    ? Number((decimalUnits(avg) * 1000000n) / maximum) / 1000000
    : 0
  const href = activityHref(period.start, period.end, currency)
  const activityHrefFor = (id: string) =>
    activityHref(
      period.start,
      period.end,
      currency,
      id === '__uncategorized__'
        ? { uncategorized: 'true' }
        : { category_id: id },
    )
  const insight = (stage: string) =>
    '/dashboard?' +
    new URLSearchParams({
      view: 'spending',
      detail: 'insights',
      stage,
      start: period.start,
      end: period.end,
    })
  const abovePrior =
    decimalUnits(report.previous.expenses) > 0n &&
    decimalUnits(report.current.change_percent ?? '0') > 20_000_000n
  const uncategorized = rows.find(
    (row) => row.id === '__uncategorized__' && decimalUnits(row.amount) > 0n,
  )
  const signalCount = Number(abovePrior) + Number(Boolean(uncategorized))
  return (
    <PortalScope name="holdings-migration">
      <section className="wf-workspace wf-spending">
        <div className="flex min-h-screen flex-col">
          <div className="px-4 pt-2 pb-6 md:px-6 md:pb-2 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
              <div>
                <div className="text-muted-foreground/80 text-2xs font-semibold tracking-[0.12em] uppercase">
                  {t('wfSpending:tabContent.spentLabel')} · {period.start} —{' '}
                  {period.end}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-[2rem] font-normal leading-[1.1] tracking-[-.03em] tabular-nums">
                    <PrivacyAmount
                      value={report.current.expenses}
                      currency={currency}
                    />
                  </h1>
                  <PrivacyToggle />
                </div>
                <div className="text-md flex min-h-5 flex-wrap items-center gap-x-3">
                  <SpendingDeltaLine
                    delta={report.current.change}
                    currency={currency}
                    deltaPct={report.current.change_percent}
                  />
                </div>
              </div>
              <CashFlowStrip
                income={report.current.income}
                spending={report.current.expenses}
                saving={report.current.to_savings}
                fromSavings={report.current.from_savings}
                currency={currency}
                incomeHref={insight('where')}
                spendingHref={insight('where')}
                savingHref={insight('where')}
              />
            </div>
          </div>
          <div
            className="flex grow flex-col"
            style={{
              backgroundImage:
                'linear-gradient(to top, color-mix(in oklab,var(--spending-deep) 8%,transparent),transparent 70%)',
            }}
          >
            <div
              className="h-70 [&_.recharts-layer]:outline-none [&_.recharts-surface]:outline-none"
              role="region"
              aria-label={t('wfSpending:tabContent.spentLabel')}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart}
                  margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
                  accessibilityLayer
                >
                  <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--spending-deep)"
                        stopOpacity={0.95}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--spending-mid)"
                        stopOpacity={0.7}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    interval="preserveStartEnd"
                    minTickGap={monthly ? 16 : 8}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                    content={({ active, payload }) => {
                      const point =
                        active &&
                        (payload?.[0]?.payload as
                          (typeof chart)[number] | undefined)
                      return point ? (
                        <div className="bg-background rounded-md border px-3 py-2 text-xs shadow-sm">
                          <div className="text-muted-foreground">
                            {point.date} — {point.end}
                          </div>
                          <PrivacyAmount
                            value={point.amount}
                            currency={currency}
                          />
                          <div className="text-muted-foreground mt-1">
                            {t('wfSpending:tabContent.avg')} ·{' '}
                            <PrivacyAmount value={avg} currency={currency} />
                          </div>
                        </div>
                      ) : null
                    }}
                  />
                  {avgCoordinate > 0 && (
                    <ReferenceLine
                      y={avgCoordinate}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="3 3"
                      strokeOpacity={0.4}
                    />
                  )}
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={!reduced}
                    onClick={(entry) => {
                      const point = entry.payload as
                        (typeof chart)[number] | undefined
                      if (point)
                        window.location.hash = activityHref(
                          point.date,
                          point.end,
                          currency,
                        )
                    }}
                  >
                    {chart.map((row) => (
                      <Cell
                        key={row.key}
                        fill={
                          row.value < 0 ? 'var(--success)' : `url(#${gradient})`
                        }
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex w-full justify-center">
                <SpendingPeriodSelector
                  {...selector}
                  className="pointer-events-auto relative z-20 w-full max-w-screen-sm sm:max-w-screen-md md:max-w-2xl lg:max-w-3xl"
                />
              </div>
            </div>
            <details className="px-4 pt-12 text-xs md:px-6 lg:px-8">
              <summary
                role="button"
                aria-label={t('spendingMigration:dailyDetails')}
              >
                {t('spendingMigration:exactChartValues')}
              </summary>
              <table>
                <caption>{t('spendingMigration:dailySpending')}</caption>
                <thead>
                  <tr>
                    <th>{t('wfCommon:date')}</th>
                    <th>{t('wfCommon:amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <Link to={activityHref(row.date, row.end, currency)}>
                          {row.key}
                        </Link>
                      </td>
                      <td>
                        <PrivacyAmount value={row.amount} currency={currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            <div className="@container grow px-4 pt-8 pb-6 md:px-6 lg:px-10 lg:pb-8">
              <div className="flex flex-col gap-6 @min-[53rem]:grid @min-[53rem]:grid-cols-[minmax(0,2fr)_minmax(24rem,1fr)] @min-[53rem]:gap-20">
                <div className="contents @min-[53rem]:block @min-[53rem]:space-y-6">
                  <DashboardCard
                    title={t('wfSpending:tabContent.whereItWent')}
                    padded={false}
                    className="order-1 overflow-hidden @min-[53rem]:order-none"
                    action={
                      <div className="flex items-center gap-3">
                        <SegmentedToggle
                          ariaLabel={t('wfSpending:tabContent.whereItWentView')}
                          items={[
                            {
                              value: 'list',
                              label: t('wfSpending:tabContent.listView'),
                            },
                            {
                              value: 'map',
                              label: t('wfSpending:tabContent.mapView'),
                            },
                          ]}
                          value={view}
                          onChange={setView}
                        />
                        <label className="text-muted-foreground flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={grouped}
                            onChange={(event) =>
                              setGrouped(event.target.checked)
                            }
                          />
                          {t('spendingMigration:groupCategories')}
                        </label>
                        <Link
                          to={insight('where')}
                          className="text-muted-foreground text-xs hover:underline"
                        >
                          {t('wfSpending:tabContent.viewAll')}
                        </Link>
                      </div>
                    }
                  >
                    {view === 'map' && !hasNegative ? (
                      <CategoryTreemapMono
                        rows={rows}
                        total={report.current.expenses}
                        currency={currency}
                        themeColor="var(--spending-deep)"
                        hasNoIncludedAccounts={!accounts.length}
                        activityHrefFor={activityHrefFor}
                      />
                    ) : (
                      <>
                        <CategoryRankedBar
                          rows={rows}
                          total={report.current.expenses}
                          currency={currency}
                          themeColor="var(--spending-deep)"
                          hasNoIncludedAccounts={!accounts.length}
                          groupRows={
                            grouped ? snapshot?.computed.groupRows : []
                          }
                          activityHrefFor={activityHrefFor}
                        />
                        {hasNegative && (
                          <p className="text-muted-foreground px-4 pb-3 text-xs">
                            {t('spendingMigration:negativeComposition')}
                          </p>
                        )}
                      </>
                    )}
                  </DashboardCard>
                  <div className="order-3 @min-[53rem]:order-none">
                    {recent.isError ? (
                      <ErrorState
                        text={recent.error.message}
                        retry={() => void recent.refetch()}
                      />
                    ) : recent.isPending ? (
                      <LoadingState />
                    ) : (
                      <RecentActivityCard
                        activities={recent.data}
                        categories={categories}
                        accounts={accounts}
                        href={href}
                      />
                    )}
                  </div>
                  <div className="order-6 @min-[53rem]:order-none">
                    <h2 className="pb-2 text-sm font-semibold tracking-tight">
                      {t('wfSpending:tabContent.digDeeper')}
                    </h2>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {[
                        {
                          stage: 'where',
                          Icon: Icons.PieChart,
                          label: 'stageWhereLabel',
                          sub: 'stageWhereSub',
                        },
                        {
                          stage: 'changed',
                          Icon: Icons.TrendingUp,
                          label: 'stageChangedLabel',
                          sub: 'stageChangedSub',
                        },
                        {
                          stage: 'when',
                          Icon: Icons.Calendar,
                          label: 'stageWhenLabel',
                          sub: 'stageWhenSub',
                        },
                      ].map(({ stage, Icon, label, sub }) => (
                        <Link
                          key={stage}
                          to={insight(stage)}
                          className="border-border/50 bg-background/30 hover:border-border hover:bg-background/60 group flex flex-col gap-3 rounded-lg border p-3.5 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <Icon
                              className="h-4 w-4"
                              style={{ color: 'var(--spending-deep)' }}
                            />
                            <Icons.ArrowRight className="text-muted-foreground/40 group-hover:text-foreground h-3.5 w-3.5 transition-colors" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              {t('wfSpending:tabContent.' + label)}
                            </div>
                            <div className="text-muted-foreground/80 mt-0.5 text-xs leading-snug">
                              {t('wfSpending:tabContent.' + sub)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="contents @min-[53rem]:block @min-[53rem]:space-y-6">
                  <div className="order-2 @min-[53rem]:order-none">
                    <BudgetLineChartCard
                      data={budgetReport}
                      categories={categories}
                      onMonth={(delta) =>
                        navigateTo('Budget', undefined, {
                          ...Object.fromEntries(route.params),
                          month: shiftMonth(month, delta),
                        })
                      }
                    />
                    {budget.isError && (
                      <ErrorState
                        text={budget.error.message}
                        retry={() => void budget.refetch()}
                      />
                    )}
                  </div>
                  {signalCount > 0 && (
                    <div className="border-border/40 bg-card/70 order-4 rounded-xl border p-4 md:p-5 @min-[53rem]:order-none">
                      <div className="mb-2 flex items-center gap-2">
                        <Icons.AlertCircle
                          className="h-4 w-4 shrink-0"
                          style={{ color: 'var(--spending-deep)' }}
                        />
                        <h3 className="text-sm font-semibold">
                          {t('wfSpending:tabContent.worthALook')}
                        </h3>
                        <span className="text-muted-foreground/70 ms-auto text-xs">
                          {t('wfSpending:tabContent.signalCount', {
                            count: signalCount,
                          })}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {abovePrior && (
                          <div className="flex gap-2 text-xs">
                            <span
                              className="w-4 shrink-0 text-base font-bold"
                              style={{ color: 'var(--status-warn)' }}
                            >
                              !
                            </span>
                            <div>
                              <div>
                                {t('wfSpending:tabContent.spendingAbovePrefix')}{' '}
                                <strong>
                                  {t('wfSpending:tabContent.pctAbove', {
                                    pct: isBalanceHidden
                                      ? '••••'
                                      : formatExactPercent(
                                          report.current.change_percent,
                                        ),
                                  })}
                                </strong>{' '}
                                {t('wfSpending:tabContent.thePriorPeriod')}
                              </div>
                              <div className="text-muted-foreground/80 mt-0.5">
                                <PrivacyAmount
                                  value={report.current.change}
                                  currency={currency}
                                />{' '}
                                ·{' '}
                                <Link
                                  to={insight('changed')}
                                  className="hover:underline"
                                >
                                  {t('wfSpending:tabContent.seeTrends')}
                                </Link>
                              </div>
                            </div>
                          </div>
                        )}
                        {uncategorized && (
                          <div className="flex gap-2 text-xs">
                            <span
                              className="w-4 shrink-0 text-base font-bold"
                              style={{ color: 'var(--spending-deep)' }}
                            >
                              +
                            </span>
                            <div>
                              <Link
                                to={activityHrefFor('__uncategorized__')}
                                className="hover:underline"
                              >
                                {t('wfSpending:dashboard.uncategorized')} ·{' '}
                                <PrivacyAmount
                                  value={uncategorized.amount}
                                  currency={currency}
                                />
                              </Link>
                              <div className="text-muted-foreground/80 mt-0.5">
                                {t('wfSpending:tabContent.categorizeToImprove')}
                              </div>
                              <Link
                                to="/settings/spending/rules"
                                className="mt-1.5 inline-block font-medium hover:underline"
                              >
                                {t('wfSpending:tabContent.createRules')}
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                      <Link
                        to={insight('changed')}
                        className="text-muted-foreground hover:text-foreground ms-6 mt-3 inline-flex items-center gap-1 text-xs hover:underline"
                      >
                        {t('wfSpending:tabContent.seeTrends')}
                      </Link>
                    </div>
                  )}
                  <div className="order-5 @min-[53rem]:order-none">
                    <EventsCard
                      asOf={asOf}
                      start={period.start}
                      end={period.end}
                      categories={categories}
                    />
                  </div>
                </div>
              </div>
            </div>
            {report.other_currencies.length > 0 && (
              <p className="text-muted-foreground px-4 pb-4 text-xs">
                {t('spendingMigration:excludedCurrencies', {
                  currencies: report.other_currencies.join(', '),
                })}
              </p>
            )}
          </div>
        </div>
      </section>
    </PortalScope>
  )
}
