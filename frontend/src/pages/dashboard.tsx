import { t as tr, ui } from '@/lib/i18n'
import { getLocale } from '@/lib/preferences'
// Adapted frontend source; provenance and license: THIRD_PARTY_NOTICES.md.
// SPDX-License-Identifier: AGPL-3.0-only
import { lazy, Suspense, useState } from 'react'
import {
  ChartNoAxesCombined,
  Wallet,
  HandCoins,
  Info,
  EllipsisVertical,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  TableProperties,
} from 'lucide-react'
import { type Account, type Category } from '@/lib/api'
import { useHistory } from '@/lib/use-history'
import { decimalUnits, formatMoneyParts } from '@/lib/money'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  SummaryMetric,
} from '@/components/primitives'
import {
  AccountRows,
  DateRangeTabs,
  PercentageChange,
  RecentActivity,
  SpendingList,
} from '@/components/financial'
import type { Navigate } from '@/components/app-shell'
import { navigateTo } from '@/lib/navigation'

// Other pages retain their existing chart and layout in this review phase.
export const BalanceChart = lazy(() =>
  import('@/components/balance-chart').then((module) => ({
    default: module.BalanceChart,
  })),
)
const OverviewChart = lazy(() =>
  import('@/components/overview-chart').then((module) => ({
    default: module.OverviewChart,
  })),
)

export default function Dashboard({
  accounts,
  categories,
  navigate,
}: {
  accounts: Account[]
  categories: Category[]
  navigate: Navigate
}) {
  const { demo, period, setPeriod, end, moveMonth, result, series } =
    useHistory('3M')
  const [spending, setSpending] = useState(false)
  const [options, setOptions] = useState(false)
  const [chartData, setChartData] = useState(false)
  const periodLabel = {
    '1M': 'past month',
    '3M': 'past 3 months',
    YTD: 'year to date',
    '1Y': 'past year',
    ALL: 'all time',
  }[period]
  return (
    <div className="overview-reference">
      <h1 id="page-title" tabIndex={-1} className="sr-only">
        {tr('dashboard:overview_0efc2e')}
      </h1>
      <header className="overview-toolbar">
        <nav
          className="overview-tabs"
          aria-label={tr('dashboard:overview_views_c14944')}
        >
          <button
            aria-current={!spending ? 'page' : undefined}
            onClick={() => setSpending(false)}
          >
            <ChartNoAxesCombined size={14} />{' '}
            {tr('dashboard:overview_0efc2e')}{' '}
          </button>
          <button
            onClick={() => navigate('Net Worth')}
            title={tr(
              'dashboard:assets_liabilities_and_historical_coverage_0ff42f',
            )}
          >
            <Wallet size={14} /> {tr('dashboard:net_worth_329352')}{' '}
          </button>
          <button
            aria-current={spending ? 'page' : undefined}
            onClick={() => setSpending(true)}
          >
            <HandCoins size={14} /> {tr('dashboard:spending_456145')}{' '}
          </button>
        </nav>
        <div className="overview-actions">
          <span
            className="overview-info"
            tabIndex={0}
            aria-label={
              demo.data?.enabled
                ? tr('messages:message_f401107d71db', { value0: end })
                : tr('dynamic:local_ledger_data_1adc29')
            }
            title={
              demo.data?.enabled
                ? tr('messages:message_204f6127ecb9', { value0: end })
                : tr('dynamic:local_ledger_db536e')
            }
          >
            <Info size={18} />
          </span>
          <button
            className="overview-round"
            aria-label={tr('dashboard:view_exact_chart_data_8a5bcd')}
            aria-pressed={chartData}
            onClick={() => setChartData(!chartData)}
          >
            <TableProperties size={18} />
          </button>
          <button
            className="overview-round"
            aria-label={tr('dashboard:overview_options_7b2c2f')}
            aria-expanded={options}
            onClick={() => setOptions(!options)}
          >
            <EllipsisVertical size={18} />
          </button>
        </div>
        {options && (
          <div className="overview-options">
            <p className="metadata">{tr('dashboard:period_ending_215798')}</p>
            <div className="month-picker">
              <button
                className="icon-button"
                aria-label={tr('dashboard:previous_month_46a299')}
                disabled={end <= '0002-12-31'}
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {new Intl.DateTimeFormat(getLocale(), {
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(`${end}T12:00:00`))}
              </span>
              <button
                className="icon-button"
                aria-label={tr('dashboard:next_month_8abf7c')}
                disabled={end >= '9999-11-01'}
                onClick={() => moveMonth(1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <p className="metadata">
              {demo.data?.enabled
                ? tr('dynamic:synthetic_demo_b890c0')
                : tr('dynamic:local_ledger_db536e')}{' '}
              · {end}
            </p>
          </div>
        )}
      </header>
      {result.isError || demo.isError ? (
        <ErrorState
          text={tr('dashboard:unable_to_load_dashboard__c0b343')}
          retry={() => {
            void demo.refetch()
            void result.refetch()
          }}
        />
      ) : result.isPending ? (
        <LoadingState text={tr('dashboard:loading_summary__9deab6')} />
      ) : !series ? (
        <EmptyState
          title={tr('dashboard:no_accounts_yet_5c5d52')}
          detail={tr(
            'dashboard:create_an_account_to_start_your_financial_overvi_fc8165',
          )}
        />
      ) : (
        <>
          <section
            className="overview-headline"
            aria-label={tr('messages:message_1abe63df38e1', {
              value0: series.currency,
            })}
          >
            <h2 className="sr-only">{tr('dashboard:total_balance_891433')}</h2>
            <p className="metadata">
              {tr(
                'dashboard:cash_balances_securities_valued_separately_in_in_ac917a',
              )}
            </p>
            <div
              className="overview-balance"
              data-testid="Total balance"
              title={tr(
                'dashboard:total_ledger_balance_not_investment_valuation_154c60',
              )}
            >
              {formatMoneyParts(series.total_balance, series.currency).map(
                (part, index) => (
                  <span
                    key={index}
                    className={
                      part.type === 'fraction' || part.type === 'decimal'
                        ? 'balance-fraction'
                        : undefined
                    }
                  >
                    {part.value}
                  </span>
                ),
              )}
            </div>
            <div className="overview-change">
              <PercentageChange
                amount={series.change}
                percentage={series.change_percent}
                currency={series.currency}
              />
              <span className="metadata">{ui(periodLabel)}</span>
            </div>
          </section>
          <div className="overview-landscape">
            <Suspense
              fallback={
                <LoadingState
                  text={tr('dashboard:loading_balance_history__745f30')}
                />
              }
            >
              <OverviewChart
                points={series.points}
                currency={series.currency}
              />
            </Suspense>
            <DateRangeTabs value={period} onChange={setPeriod} />
            {chartData && (
              <div className="overview-data table-scroll">
                <table>
                  <caption>
                    {' '}
                    {tr('dashboard:exact_closing_ledger_balances__a828cb')}{' '}
                    {series.currency}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{tr('dashboard:date_eb9a4b')}</th>
                      <th scope="col">{tr('dashboard:balance_90eef6')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.points.map((point) => (
                      <tr key={point.date}>
                        <td>{point.date}</td>
                        <td className="amount-cell">
                          <Money
                            value={point.balance}
                            currency={series.currency}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="overview-columns">
              <section className="overview-accounts">
                <div className="overview-section-heading">
                  <h2>
                    {spending
                      ? tr('dynamic:spending_by_category_d4aadf')
                      : tr('dynamic:accounts_36bae3')}
                  </h2>
                  <button
                    className="icon-button"
                    aria-label={
                      spending
                        ? tr('dynamic:open_transactions_f39200')
                        : tr('dynamic:manage_accounts_c49407')
                    }
                    onClick={() =>
                      navigate(spending ? 'Transactions' : 'Accounts')
                    }
                  >
                    <ListFilter size={16} />
                  </button>
                </div>
                {spending ? (
                  <SpendingList series={series} />
                ) : (
                  <AccountRows
                    chevron
                    accounts={[...result.data.accounts].sort(
                      (a, b) =>
                        a.currency.localeCompare(b.currency) ||
                        (decimalUnits(a.balance) > decimalUnits(b.balance)
                          ? -1
                          : decimalUnits(a.balance) < decimalUnits(b.balance)
                            ? 1
                            : a.name.localeCompare(b.name)),
                    )}
                    navigate={navigate}
                  />
                )}
              </section>
              <div className="overview-secondary">
                <section>
                  <div className="overview-section-heading">
                    <h2>{tr('dashboard:cash_flow_a94d50')}</h2>
                    <span className="metadata">{ui(periodLabel)}</span>
                  </div>
                  <div className="overview-flow">
                    <SummaryMetric
                      title={tr('dashboard:income_1c89b1')}
                      value={series.income}
                      currency={series.currency}
                      detail={tr('dashboard:money_earned_c75520')}
                      tone="positive"
                    />
                    <SummaryMetric
                      title={tr('dashboard:expenses_8d437d')}
                      value={series.expenses}
                      currency={series.currency}
                      detail={tr('dashboard:money_spent_431827')}
                      tone="negative"
                    />
                    <SummaryMetric
                      title={tr('dashboard:net_cash_flow_d649f1')}
                      value={series.net_flow}
                      currency={series.currency}
                      detail={tr('dashboard:income_minus_expenses_a5e384')}
                      tone={
                        series.net_flow.startsWith('-')
                          ? 'negative'
                          : 'positive'
                      }
                    />
                  </div>
                  <p className="sr-only">
                    {tr(
                      'dashboard:transfers_and_opening_balances_are_excluded_from_e7655f',
                    )}
                  </p>
                </section>
                <section>
                  <div className="overview-section-heading">
                    <h2>{tr('dashboard:recent_activity_72d561')}</h2>
                    <button
                      className="overview-view-all"
                      onClick={() => navigate('Transactions')}
                    >
                      {' '}
                      {tr('dashboard:view_all_931e1a')}{' '}
                      <ChevronRight size={12} />
                    </button>
                  </div>
                  <RecentActivity
                    rows={result.data.recent_transactions.slice(0, 4)}
                    accounts={accounts}
                    categories={categories}
                  />
                  <div className="form-actions">
                    <button
                      className="text-action"
                      onClick={() =>
                        navigateTo('Transactions', undefined, {
                          review_status: 'NEEDS_REVIEW',
                        })
                      }
                    >
                      {tr('dashboard:review_transactions_787089')}
                    </button>
                    <button
                      className="text-action"
                      onClick={() => navigate('Budget')}
                    >
                      {tr('dashboard:spending_budgets_e964a3')}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
