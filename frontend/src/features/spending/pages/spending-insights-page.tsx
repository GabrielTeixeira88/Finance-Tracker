// Source composition adapted from Wealthfolio 92b4647 spending-insights-page and stage renderers.
// SPDX-License-Identifier: AGPL-3.0-only
import '../i18n'
import '../spending.css'
import '../../holdings/migration.css'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Category, Account } from '@/lib/api'
import type { BudgetReport } from '@/lib/budget-api'
import { decimalUnits, sumMoney } from '@/lib/money'
import { navigateTo, useRoute } from '@/lib/navigation'
import { shiftMonth } from '@/lib/budget-api'
import { dayAfter } from '@/lib/spending-period'
import { ErrorState, LoadingState } from '@/components/primitives'
import { PortalScope } from '@/vendor/wealthfolio/ui/components/ui/portal-scope'
import { HeadlineCard } from '../components/reports/insights/headline-card'
import { buildHeadline } from '../lib/headline'
import { headlineDescriptors } from '../lib/headline-descriptors'
import { Page, PageHeader, PageContent, Button, PrivacyAmount } from '../ui'
import { Link, safePercent, exactAbs } from '../compat'
import { useSpendingPeriod, activityHref } from '../period-adapter'
import { getBudgetWorkspace, sourceBudgetSnapshot } from '../budget-adapter'
import { StageNav } from '../components/reports/insights/stage-nav'
import { SpendingPeriodSelector } from '../components/spending-period-toggle'
import {
  PaceCard,
  SpentThisPeriodCard,
  NetCashflowCard,
} from '../components/reports/insights/position-cards'
import { MoneyFlowSection } from '../components/reports/insights/money-flow-section'
import { CategoryHierarchyTable } from '../components/reports/category-hierarchy-table'
import {
  ComparisonTable,
  SparklineRow,
} from '../components/reports/insights/change-cards'
import LifeEvents from '@/pages/life-events'

export default function SpendingInsightsPage({
  data: monthly,
  categories,
  accounts,
}: {
  data: BudgetReport
  categories: Category[]
  accounts: Account[]
}) {
  const { t } = useTranslation(),
    route = useRoute()
  const { period, data, selector } = useSpendingPeriod(
    monthly.as_of,
    monthly.currency,
  )
  const stage =
    route.params.get('stage') === 'changed'
      ? 'changed'
      : route.params.get('stage') === 'when'
        ? 'when'
        : 'where'
  const [sort, setSort] = useState<'spent' | 'delta' | 'name'>('spent'),
    [all, setAll] = useState(false)
  const filter = route.params.get('plan_filter') ?? 'all'
  const setFilter = (value: string) =>
    navigateTo('Budget', undefined, {
      ...Object.fromEntries(route.params),
      view: 'Insights',
      plan_filter: value,
    })
  const budget = useQuery({
    queryKey: [
      'budgets',
      'workspace',
      monthly.month,
      monthly.currency,
      monthly.as_of,
    ],
    queryFn: ({ signal }) =>
      getBudgetWorkspace(
        monthly.month,
        monthly.currency,
        monthly.as_of,
        signal,
      ),
  })
  const snapshot = useMemo(
    () =>
      budget.data
        ? sourceBudgetSnapshot(budget.data, categories, 'monthly', data.data)
        : undefined,
    [budget.data, categories, data.data],
  )
  const monthEnd = new Date(shiftMonth(monthly.month, 1) + '-01T00:00:00Z')
  monthEnd.setUTCDate(monthEnd.getUTCDate() - 1)
  const monthlyEnd = monthEnd.toISOString().slice(0, 10)
  const monthlyThrough = monthlyEnd < monthly.as_of ? monthlyEnd : monthly.as_of
  const onCategoryClick = (id: string) => {
    window.location.hash = activityHref(
      monthly.month + '-01',
      monthlyThrough,
      monthly.currency,
      id === '__uncategorized__'
        ? { uncategorized: 'true' }
        : { category_id: id },
    )
  }
  const choose = (next: string) =>
    navigateTo('Budget', undefined, {
      ...Object.fromEntries(route.params),
      view: next === 'when' ? 'Life Events' : 'Insights',
      stage: next,
    })
  const report = data.data
  const totalMovement = report
    ? sumMoney(report.categories.map((row) => exactAbs(row.change)))
    : '0'
  const movers =
    report?.categories
      .map((row) => ({
        id: row.category_id ?? '__uncategorized__',
        name: row.name,
        current: row.current,
        prior: row.previous,
        delta: row.change,
        pct: row.change_percent,
        showPct: row.change_percent !== null,
        shareOfMovement: safePercent(exactAbs(row.change), totalMovement),
        icon: categories.find((c) => c.id === row.category_id)?.icon ?? null,
        color: categories.find((c) => c.id === row.category_id)?.color ?? null,
      }))
      .sort((a, b) =>
        decimalUnits(exactAbs(a.delta)) > decimalUnits(exactAbs(b.delta))
          ? -1
          : 1,
      ) ?? []
  const filtered = monthly.categories.filter(
    (row) =>
      filter === 'all' ||
      (filter === 'movers' && decimalUnits(row.change) !== 0n) ||
      (filter === 'no_budget' && !row.target_id) ||
      (filter === 'over' && decimalUnits(row.remaining) < 0n),
  )
  const taxonomyCategories = categories.map((row) => ({
    ...row,
    parentId: null,
    taxonomyId: 'spending_categories',
  }))
  if (monthly.categories.some((row) => row.category_id === null))
    taxonomyCategories.push({
      id: '__uncategorized__',
      name: t('wfSpending:dashboard.uncategorized'),
      parentId: null,
      taxonomyId: 'spending_categories',
      icon: null,
      color: null,
    })
  return (
    <PortalScope name="holdings-migration">
      <section className="wf-workspace wf-spending">
        <Page>
          <PageHeader
            className="spending-page-header"
            heading={t('wfSpending:insightsPage.heading')}
            onBack={() =>
              navigateTo('Budget', undefined, {
                start: period.start,
                end: period.end,
              })
            }
            actions={
              <SpendingPeriodSelector {...selector} appearance="header" />
            }
          />
          <PageContent className="space-y-6">
            <StageNav stage={stage} onStageChange={choose} />
            {data.isPending ? (
              <LoadingState />
            ) : data.isError ? (
              <ErrorState
                text={data.error.message}
                retry={() => void data.refetch()}
              />
            ) : (
              report && (
                <>
                  {stage === 'where' && (
                    <div className="flex flex-col gap-6">
                      <div className="grid gap-4 md:grid-cols-3">
                        <PaceCard data={monthly} />
                        <SpentThisPeriodCard
                          report={report}
                          categories={categories}
                        />
                        <NetCashflowCard report={report} />
                      </div>
                      <MoneyFlowSection
                        key={period.start + period.end}
                        report={report}
                        budget={snapshot}
                        categories={categories}
                        onCategoryClick={onCategoryClick}
                      />
                      <section id="breakdown">
                        <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <h2 className="text-foreground text-base font-semibold tracking-tight">
                              {t('wfSpending:whereIAm.spendingPlan')}
                            </h2>
                            <p className="text-muted-foreground text-xs">
                              {t('spendingMigration:monthlyTargetContext', {
                                month: monthly.month,
                              })}
                            </p>
                          </div>
                          <label className="text-muted-foreground flex items-center gap-2 text-xs">
                            {t('wfSpending:whereIAm.sortBy')}
                            <select
                              value={sort}
                              onChange={(event) =>
                                setSort(event.target.value as typeof sort)
                              }
                            >
                              <option value="spent">
                                {t('wfSpending:whereIAm.spent')}
                              </option>
                              <option value="delta">
                                {t('wfSpending:whatChanged.deltaDollar')}
                              </option>
                              <option value="name">{t('wfCommon:name')}</option>
                            </select>
                          </label>
                        </header>
                        <div className="mb-4 flex flex-wrap gap-1.5">
                          {['all', 'over', 'movers', 'no_budget'].map(
                            (value) => (
                              <Button
                                key={value}
                                variant={
                                  filter === value ? 'secondary' : 'ghost'
                                }
                                size="sm"
                                onClick={() => setFilter(value)}
                                aria-pressed={filter === value}
                              >
                                {t(
                                  {
                                    all: 'spendingMigration:filter_all',
                                    over: 'spendingMigration:filter_over',
                                    movers: 'spendingMigration:filter_movers',
                                    no_budget:
                                      'spendingMigration:filter_no_budget',
                                  }[value]!,
                                )}
                              </Button>
                            ),
                          )}
                        </div>
                        <CategoryHierarchyTable
                          breakdown={filtered.map((row) => ({
                            categoryId: row.category_id ?? '__uncategorized__',
                            amount: row.spent,
                            count: 0,
                          }))}
                          priorBreakdown={monthly.categories.map((row) => ({
                            categoryId: row.category_id ?? '__uncategorized__',
                            amount: row.previous,
                            count: 0,
                          }))}
                          budgetRows={
                            snapshot?.computed.groupRows.flatMap(
                              (group) => group.categories,
                            ) ?? []
                          }
                          groupRows={snapshot?.computed.groupRows}
                          taxonomyCategories={taxonomyCategories}
                          currency={monthly.currency}
                          isLoading={budget.isPending}
                          sort={sort}
                          onCategoryClick={onCategoryClick}
                        />
                        <Link
                          to={activityHref(
                            monthly.month + '-01',
                            monthlyThrough,
                            monthly.currency,
                          )}
                          className="mt-3 inline-block text-xs hover:underline"
                        >
                          {t('wfSpending:whereIAm.openTransactions')}
                        </Link>
                      </section>
                    </div>
                  )}
                  {stage === 'changed' && (
                    <div className="flex flex-col gap-6">
                      <HeadlineCard
                        headline={buildHeadline({
                          ...headlineDescriptors(report),
                          currentTotal: report.current.expenses,
                          priorTotal: report.previous.expenses,
                          priorLabel:
                            report.previous_start +
                            ' — ' +
                            dayAfter(report.previous_end_exclusive, -1),
                          metaLabel: period.start + ' — ' + period.end,
                          t,
                        })}
                        currency={monthly.currency}
                        isLoading={false}
                      />

                      <section>
                        <h2 className="text-foreground mb-4 text-base font-semibold tracking-tight">
                          {t('wfSpending:whatChanged.categoryTrends')}
                        </h2>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {(all ? movers : movers.slice(0, 6)).map((row) => {
                            const source = report.categories.find(
                              (item) =>
                                item.category_id ===
                                (row.id === '__uncategorized__'
                                  ? null
                                  : row.id),
                            )!
                            const observations =
                              report.daily.length <= 35 && source.daily_history
                                ? report.daily.map((day) => ({
                                    amount:
                                      source.daily_history!.find(
                                        (point) => point.date === day.date,
                                      )?.amount ?? '0',
                                  }))
                                : source.history.filter(
                                    (point) =>
                                      point.month >= period.start.slice(0, 7),
                                  )
                            const high = observations.reduce(
                              (value, item) =>
                                decimalUnits(exactAbs(item.amount)) >
                                decimalUnits(value)
                                  ? exactAbs(item.amount)
                                  : value,
                              '0',
                            )
                            return (
                              <SparklineRow
                                key={row.id}
                                row={{
                                  ...row,
                                  total: row.current,
                                  percent: row.pct,
                                  series: observations.map((point) => ({
                                    value:
                                      (decimalUnits(point.amount) < 0n
                                        ? -1
                                        : 1) *
                                      safePercent(exactAbs(point.amount), high),
                                  })),
                                }}
                                currency={monthly.currency}
                                showPill
                                onCategoryClick={onCategoryClick}
                              />
                            )
                          })}
                        </div>
                        {!all && movers.length > 6 && (
                          <Button variant="ghost" onClick={() => setAll(true)}>
                            {t('wfSpending:whatChanged.showMore', {
                              count: movers.length - 6,
                            })}
                          </Button>
                        )}
                      </section>
                      <section>
                        <h2 className="text-foreground mb-4 text-base font-semibold tracking-tight">
                          {t('wfSpending:whatChanged.categoryDetails')}
                        </h2>
                        <ComparisonTable
                          movers={movers}
                          labels={{
                            current: period.start + ' — ' + period.end,
                            prior:
                              report.previous_start +
                              ' — ' +
                              dayAfter(report.previous_end_exclusive, -1),
                          }}
                          periodState={{
                            kind:
                              decimalUnits(report.previous.expenses) === 0n
                                ? 'no_prior_period'
                                : 'valid_comparison',
                          }}
                          currency={monthly.currency}
                          onCategoryClick={onCategoryClick}
                        />
                      </section>
                    </div>
                  )}
                  {stage === 'changed' &&
                    period.start === monthly.date_from &&
                    period.end === monthly.date_to && (
                      <details className="text-sm">
                        <summary>
                          {t('spendingMigration:payeeSpending')}
                        </summary>
                        {monthly.payees.map((row) => (
                          <Link
                            key={row.id ?? 'none'}
                            to={activityHref(
                              period.start,
                              period.end,
                              monthly.currency,
                              row.id
                                ? { payee_id: row.id }
                                : { no_payee: 'true' },
                            )}
                            className="flex items-center justify-between border-b py-2"
                          >
                            <span>{row.name}</span>
                            <PrivacyAmount
                              value={row.spent}
                              currency={monthly.currency}
                            />
                          </Link>
                        ))}
                      </details>
                    )}
                  {stage === 'when' && (
                    <LifeEvents context={monthly} workspace={report} />
                  )}
                  {budget.isError && (
                    <ErrorState
                      text={budget.error.message}
                      retry={() => void budget.refetch()}
                    />
                  )}
                  {!accounts.length && (
                    <p className="text-muted-foreground text-sm">
                      {t('wfSpending:tabContent.noAccountsSelected')}
                    </p>
                  )}
                </>
              )
            )}
          </PageContent>
        </Page>
      </section>
    </PortalScope>
  )
}
