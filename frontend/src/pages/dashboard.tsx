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
  const {
    demo,
    period,
    setPeriod,
    end,
    moveMonth,
    result,
    series,
    setCurrency,
  } = useHistory('3M')
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
        Overview
      </h1>
      <header className="overview-toolbar">
        <nav className="overview-tabs" aria-label="Overview views">
          <button
            aria-current={!spending ? 'page' : undefined}
            onClick={() => setSpending(false)}
          >
            <ChartNoAxesCombined size={14} />
            Overview
          </button>
          <button
            onClick={() => navigate('Net Worth')}
            title="Read-only ledger preview"
          >
            <Wallet size={14} />
            Net Worth
          </button>
          <button
            aria-current={spending ? 'page' : undefined}
            onClick={() => setSpending(true)}
          >
            <HandCoins size={14} />
            Spending
          </button>
        </nav>
        <div className="overview-actions">
          <span
            className="overview-info"
            tabIndex={0}
            aria-label={
              demo.data?.enabled
                ? `Synthetic demo data through ${end}`
                : 'Local ledger data'
            }
            title={
              demo.data?.enabled ? `Synthetic demo · ${end}` : 'Local ledger'
            }
          >
            <Info size={18} />
          </span>
          <button
            className="overview-round"
            aria-label="View exact chart data"
            aria-pressed={chartData}
            onClick={() => setChartData(!chartData)}
          >
            <TableProperties size={18} />
          </button>
          <button
            className="overview-round"
            aria-label="Overview options"
            aria-expanded={options}
            onClick={() => setOptions(!options)}
          >
            <EllipsisVertical size={18} />
          </button>
        </div>
        {options && (
          <div className="overview-options">
            <p className="metadata">Period ending</p>
            <div className="month-picker">
              <button
                className="icon-button"
                aria-label="Previous month"
                disabled={end <= '0002-12-31'}
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {new Intl.DateTimeFormat(navigator.language, {
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(`${end}T12:00:00`))}
              </span>
              <button
                className="icon-button"
                aria-label="Next month"
                disabled={end >= '9999-11-01'}
                onClick={() => moveMonth(1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <p className="metadata">
              {demo.data?.enabled ? 'Synthetic demo' : 'Local ledger'} · {end}
            </p>
            {!!series && (result.data?.series.length ?? 0) > 1 && (
              <label className="field">
                Currency
                <select
                  value={series.currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {result.data?.series.map((s) => (
                    <option key={s.currency}>{s.currency}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </header>
      {result.isError || demo.isError ? (
        <ErrorState
          text="Unable to load dashboard."
          retry={() => {
            void demo.refetch()
            void result.refetch()
          }}
        />
      ) : result.isPending ? (
        <LoadingState text="Loading summary…" />
      ) : !series ? (
        <EmptyState
          title="No accounts yet"
          detail="Create an account to start your financial overview."
        />
      ) : (
        <>
          <section
            className="overview-headline"
            aria-label={`${series.currency} summary`}
          >
            <h2 className="sr-only">Total balance</h2>
            <p className="metadata">
              Cash balances · Securities valued separately in Investments
            </p>
            <div
              className="overview-balance"
              data-testid="Total balance"
              title="Total ledger balance; not investment valuation"
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
              <span className="metadata">{periodLabel}</span>
            </div>
          </section>
          <div className="overview-landscape">
            <Suspense
              fallback={<LoadingState text="Loading balance history…" />}
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
                    Exact closing ledger balances · {series.currency}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Balance</th>
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
                  <h2>{spending ? 'Spending by category' : 'Accounts'}</h2>
                  <button
                    className="icon-button"
                    aria-label={
                      spending ? 'Open transactions' : 'Manage accounts'
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
                    <h2>Cash flow</h2>
                    <span className="metadata">{periodLabel}</span>
                  </div>
                  <div className="overview-flow">
                    <SummaryMetric
                      title="Income"
                      value={series.income}
                      currency={series.currency}
                      detail="Money earned"
                      tone="positive"
                    />
                    <SummaryMetric
                      title="Expenses"
                      value={series.expenses}
                      currency={series.currency}
                      detail="Money spent"
                      tone="negative"
                    />
                    <SummaryMetric
                      title="Net cash flow"
                      value={series.net_flow}
                      currency={series.currency}
                      detail="Income minus expenses"
                      tone={
                        series.net_flow.startsWith('-')
                          ? 'negative'
                          : 'positive'
                      }
                    />
                  </div>
                  <p className="sr-only">
                    Transfers and opening balances are excluded from income and
                    expenses.
                  </p>
                </section>
                <section>
                  <div className="overview-section-heading">
                    <h2>Recent activity</h2>
                    <button
                      className="overview-view-all"
                      onClick={() => navigate('Transactions')}
                    >
                      View all <ChevronRight size={12} />
                    </button>
                  </div>
                  <RecentActivity
                    rows={result.data.recent_transactions.slice(0, 4)}
                    accounts={accounts}
                    categories={categories}
                  />
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
