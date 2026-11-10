// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 pages/income/income-page.tsx.
// Local API values, exact native-currency summaries and existing detail navigation.
import { lazy, Suspense, type ReactNode } from 'react'
import { DollarSign, PieChart as PieIcon } from 'lucide-react'
import { t } from '@/lib/i18n'
import {
  incomeChange,
  receivedIncome,
  previousYear,
} from '@/lib/income-dashboard'
import { incomeSummary } from '@/lib/income-summary'
import {
  percent,
  type Income,
  type IncomeReporting,
} from '@/lib/investment-analytics'
import { IncomeCurrencyMix } from './income-currency-mix'
import { compositionData, compositionColors } from '@/lib/composition'
import { decimalUnits, sumMoney, unitsToMoney, formatMoney } from '@/lib/money'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { DashboardCard } from './dashboard-card'
import { EmptyState, LoadingState, Money } from './primitives'
import './income-dashboard.css'

const IncomeChart = lazy(() => import('./income-chart'))
const text = (key: string) => t(`income_dashboard:${key}`)
export function IncomeCard({
  title,
  children,
  className = '',
  action,
}: {
  title: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <DashboardCard
      title={title}
      className={`income-source-card ${className}`}
      action={action}
    >
      {children}
    </DashboardCard>
  )
}
export function ReceivedIncomeDashboard({
  data,
  previous,
  report,
  currency,
  start,
  end,
  period,
  onAccrued,
  onSecurity,
  securityNames = {},
}: {
  data: Income
  previous?: Income
  report?: IncomeReporting
  currency: string
  start: string
  end: string
  period: string
  onAccrued: () => void
  onSecurity: (id: string) => void
  securityNames?: Record<string, string>
}) {
  const { hidden } = useFinancialPrivacy()
  const summary = receivedIncome(
    data,
    currency,
    start,
    end,
    period === 'ALL' ? data : previous,
  )
  // Comparisons use the same calendar window a year earlier, including zero-payment months.
  const previousSummary =
    previous && start
      ? incomeSummary(
          previous,
          currency,
          previousYear(start),
          previousYear(end),
        )
      : null
  const totalChange =
    period === 'ALL'
      ? null
      : incomeChange(summary.total, previousSummary?.total ?? null)
  const averageChange =
    period === 'ALL'
      ? null
      : incomeChange(summary.average, previousSummary?.average ?? null)
  const positive = compositionData(summary.types, true)
  const sources = (data.breakdowns.security ?? [])
    .filter((row) => row.currency === currency && decimalUnits(row.net) > 0n)
    .sort((a, b) =>
      decimalUnits(a.net) === decimalUnits(b.net)
        ? a.name.localeCompare(b.name)
        : decimalUnits(a.net) > decimalUnits(b.net)
          ? -1
          : 1,
    )
  const leading = sources.slice(0, 5)
  const other = sources.slice(5)
  const sourceSegments = compositionData(
    [
      ...leading.map((row) => ({ name: row.name, value: row.net })),
      ...(other.length
        ? [
            {
              name: text('other_sources'),
              value: sumMoney(other.map((row) => row.net)),
            },
          ]
        : []),
    ],
    (data.breakdowns.security ?? [])
      .filter((row) => row.currency === currency)
      .every((row) => decimalUnits(row.net) >= 0n),
  )
  const change = (value: string | null) =>
    value === null ? (
      <p className="metadata">
        {text(period === 'ALL' ? 'recorded_history' : 'no_comparison')}
      </p>
    ) : (
      <p className="metadata">
        <span className={decimalUnits(value) < 0n ? 'expense' : 'income'}>
          {percent(value)}
        </span>{' '}
        {text('same_period')}
      </p>
    )
  return (
    <div className="income-dashboard">
      <div className="income-metric-grid">
        <IncomeCard
          title={text(
            period === 'ALL'
              ? 'all_time_income'
              : period === 'YTD'
                ? 'ytd_income'
                : period === 'LAST_YEAR'
                  ? 'last_year_income'
                  : 'received_total',
          )}
          className="income-summary-card"
          action={<DollarSign size={15} />}
        >
          <div className="income-total-value">
            <Money value={summary.total} currency={currency} />
            {report && <IncomeCurrencyMix report={report} />}
          </div>
          {change(totalChange)}
        </IncomeCard>
        <IncomeCard
          title={text('monthly_average')}
          className="income-summary-card"
          action={<DollarSign size={15} />}
        >
          <Money value={summary.average} currency={currency} />
          {change(averageChange)}
        </IncomeCard>
        <IncomeCard
          title={text('income_sources')}
          className="income-summary-card"
          action={<PieIcon size={15} />}
        >
          {summary.types.map((source, index) => (
            <div className="received-source" key={source.name}>
              <div>
                <span>
                  {text(source.name === 'DIVIDEND' ? 'dividends' : 'interest')}
                </span>
                <Money value={source.value} currency={currency} />
              </div>
              {positive &&
                decimalUnits(sumMoney(summary.types.map((s) => s.value))) >
                  0n && (
                  <div className="received-source-track">
                    <span
                      style={{
                        width: `${positive[index].coordinate}%`,
                        background: compositionColors[index],
                      }}
                    >
                      {percent(
                        unitsToMoney(
                          (decimalUnits(source.value) * 100_000_000n) /
                            decimalUnits(summary.total),
                        ),
                      )}
                    </span>
                  </div>
                )}
            </div>
          ))}
        </IncomeCard>
      </div>
      {!summary.events.length ? (
        <div className="received-empty">
          <DollarSign size={30} aria-hidden="true" />
          <EmptyState
            title={text('no_payments')}
            detail={text('no_payments_detail')}
          />
          <button onClick={onAccrued}>{text('explore_accrued')}</button>
        </div>
      ) : (
        <div className="income-content-grid">
          <IncomeCard
            title={text('income_history')}
            className="income-history-card"
          >
            <Suspense fallback={<LoadingState />}>
              <IncomeChart
                rows={summary.rows}
                accounts={summary.accounts}
                currency={currency}
                period={period}
              />
            </Suspense>
          </IncomeCard>
          <IncomeCard
            title={text('top_ten_sources')}
            className="income-sources-card"
          >
            <div className="income-ranking-strip" aria-hidden="true">
              {sourceSegments?.map((segment) => (
                <span
                  key={segment.name}
                  title={
                    hidden
                      ? text('hidden_amount')
                      : `${segment.name}: ${formatMoney(segment.exactValue, currency)}`
                  }
                  style={{
                    flexGrow: segment.coordinate,
                    background: segment.color,
                  }}
                />
              ))}
            </div>
            <ol className="received-ranking">
              {sources.slice(0, 10).map((source) => (
                <li key={source.id ?? source.name}>
                  <button
                    aria-label={source.name}
                    disabled={!source.id}
                    onClick={() => source.id && onSecurity(source.id)}
                  >
                    <span className="income-symbol" title={source.name}>
                      {source.id ? source.name : 'CASH'}
                    </span>
                    <span className="income-security-name">
                      {source.id
                        ? (securityNames[source.id] ?? source.name)
                        : text('cash_interest')}
                    </span>
                  </button>
                  <Money value={source.net} currency={currency} />
                </li>
              ))}
            </ol>
          </IncomeCard>
        </div>
      )}
      <details className="income-method-note">
        <summary>{text('calculation_details')}</summary>
        <p className="metadata">{text('received_definition')}</p>
        <p className="metadata">
          {summary.months} {text('calendar_months')}
        </p>
      </details>
    </div>
  )
}
