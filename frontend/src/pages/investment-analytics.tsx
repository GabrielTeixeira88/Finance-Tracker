import { AlertTriangle } from 'lucide-react'
import { analyticsPeriods } from '@/lib/investment-analytics'
import { incomeSummary } from '@/lib/income-summary'
import { MotionChoice } from '@/components/selection-indicator'
import { useSelectionId } from '@/lib/motion'
import { useRoute, navigateTo } from '@/lib/navigation'
import { t as tr, ui } from '@/lib/i18n'
import { exactFormData } from '@/lib/localized-number'
import { CompositionChart } from '@/components/composition-chart'
import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  SectionHeader,
} from '@/components/primitives'
import { Button } from '@/components/ui/button'
import {
  analyticsParams,
  startDate,
  classificationSchema,
  getAllocation,
  getIncome,
  getInsights,
  getPerformance,
  percent,
  type Allocation,
  type Income,
  type Insights,
} from '@/lib/investment-analytics'
import { getAssets } from '@/lib/investments'
import { request } from '@/lib/api'
import { decimalUnits, sumMoney, formatDate } from '@/lib/money'
import { useWrite } from '@/lib/use-write'

const PerformanceChart = lazy(() => import('@/components/performance-chart'))
const IncomeChart = lazy(() => import('@/components/income-chart'))

function MetricReasons({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null
  const message = reasons
    .map((r) => r.replaceAll('_', ' ').toLowerCase())
    .join(' / ')
  return (
    <details className="metric-reasons">
      <summary aria-label={tr('parity:metric_coverage')} title={message}>
        <AlertTriangle size={12} />
      </summary>
      <p>{message}</p>
    </details>
  )
}

export function NullableMoney({
  value,
  currency,
  minorUnits = false,
}: {
  minorUnits?: boolean
  value: string | null
  currency: string
}) {
  return value === null ? (
    <span className="metadata">
      {tr('investment_analytics:unavailable_2c9c1f')}
    </span>
  ) : (
    <Money value={value} currency={currency} minorUnits={minorUnits} />
  )
}

export function AnalyticsSummary({
  accountId,
  asOf,
  onOpen,
}: {
  accountId: string
  asOf: string
  onOpen: () => void
}) {
  const params = analyticsParams(
    startDate('3M', asOf, ''),
    asOf,
    'BRL',
    accountId,
  )
  const query = useQuery({
    queryKey: ['investment-performance', params],
    queryFn: ({ signal }) => getPerformance(params, signal),
  })
  return (
    <section
      aria-label={tr('investment_analytics:investment_return_summary_d0984c')}
    >
      <div className="investment-toolbar">
        <span className="metadata">
          {tr(
            'investment_analytics:last_3_months_brl_reporting_cash_flow_adjusted_87cf8a',
          )}
        </span>
        <Button variant="ghost" onClick={onOpen}>
          {tr('investment_analytics:explore_performance_1a6a06')}
        </Button>
      </div>
      {query.data ? (
        <div className="investment-metrics">
          <div>
            <span className="metadata">
              {tr('investment_analytics:time_weighted_return_5e454c')}
            </span>
            {percent(query.data.twr.value)}
          </div>
          <div>
            <span className="metadata">
              {tr('investment_analytics:xirr_annualized_cf8763')}
            </span>
            {percent(query.data.xirr.value)}
          </div>
          <div>
            <span className="metadata">
              {tr('investment_analytics:period_gain_loss_d4939c')}
            </span>
            <NullableMoney
              value={query.data.absolute_gain.value}
              currency="BRL"
            />
          </div>
        </div>
      ) : query.isError ? (
        <p className="metadata">
          {tr(
            'investment_analytics:performance_unavailable_open_performance_to_insp_5821d2',
          )}
        </p>
      ) : (
        <LoadingState
          text={tr('investment_analytics:calculating_returns__356489')}
        />
      )}
    </section>
  )
}

export default function InvestmentAnalytics({
  externalRangeControls = false,
  view,
  accountId,
  asOf,
  onSecurity,
}: {
  externalRangeControls?: boolean
  view: string
  accountId: string
  asOf: string
  onSecurity: (id: string) => void
}) {
  const route = useRoute()
  const rangeId = useSelectionId()
  const update = (values: Record<string, string>) =>
    navigateTo('Investments', undefined, {
      ...Object.fromEntries(route.params),
      view,
      ...values,
    })
  const period = route.params.get('range') || (view === 'Income' ? 'ALL' : '3M')
  const custom = route.params.get('start') || asOf.slice(0, 8) + '01'
  const setCustom = (start: string) => update({ start })
  const currency = route.params.get('currency') || 'BRL'
  const setCurrency = (currency: string) => update({ currency })
  const benchmark = route.params.get('benchmark') || ''
  const setBenchmark = (benchmark: string) => update({ benchmark })
  const start = startDate(period, asOf, custom)
  const params = analyticsParams(
    period === 'ALL' && view === 'Performance' ? '' : start,
    asOf,
    currency,
    accountId,
    benchmark,
  )
  const detailParams = analyticsParams(start, asOf, currency, accountId)
  const assets = useQuery({
    queryKey: ['investment-assets'],
    queryFn: () => getAssets(),
  })
  const performance = useQuery({
    queryKey: ['investment-performance', params],
    queryFn: ({ signal }) => getPerformance(params, signal),
    enabled: view === 'Performance',
  })
  const income = useQuery({
    queryKey: ['investment-income', params],
    queryFn: ({ signal }) => getIncome(params, signal),
    enabled: view === 'Income',
  })
  const allocation = useQuery({
    queryKey: ['investment-allocation', params],
    queryFn: ({ signal }) => getAllocation(params, signal),
    enabled: view === 'Allocation',
  })
  const insights = useQuery({
    queryKey: ['investment-insights', detailParams],
    queryFn: ({ signal }) => getInsights(detailParams, signal),
    enabled: view === 'Performance' || view === 'Allocation',
  })
  const query =
    view === 'Performance'
      ? performance
      : view === 'Income'
        ? income
        : allocation
  return (
    <section
      className={`analytics-page analytics-${view.toLowerCase()}`}
      aria-label={tr('messages:message_0f171b582664', {
        value0: ui(view.toLowerCase()),
      })}
    >
      <div className="investment-toolbar">
        {!externalRangeControls && view !== 'Allocation' && (
          <nav
            className="range-tabs"
            aria-label={tr('investment_analytics:analytics_period_2d5f60')}
          >
            {analyticsPeriods.map((range) => (
              <MotionChoice
                key={range}
                groupId={rangeId}
                selected={period === range}
                onClick={() => update({ range })}
              >
                {ui(range)}
              </MotionChoice>
            ))}
          </nav>
        )}
        {period === 'Custom' && view !== 'Allocation' && (
          <Field label={tr('investment_analytics:period_opening_date_008580')}>
            <input
              type="date"
              value={custom}
              max={asOf}
              onChange={(e) => setCustom(e.target.value)}
            />
          </Field>
        )}
        {!externalRangeControls && view !== 'Income' && (
          <Field label={tr('investment_analytics:analytics_currency_ceeca4')}>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {['BRL', 'USD', 'EUR', 'JPY'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        )}
        {view === 'Performance' && (
          <Field label={tr('investment_analytics:benchmark_9ed99e')}>
            <select
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value)}
            >
              <option value="">
                {tr('investment_analytics:no_benchmark_4b21b1')}
              </option>
              {assets.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} · {a.currency}{' '}
                  {tr('investment_analytics:price_proxy_334a90')}{' '}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {query.isPending ? (
        <LoadingState
          text={tr(
            'investment_analytics:calculating_investment_analytics__4e9228',
          )}
        />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          {view === 'Performance' && performance.data && (
            <>
              <div className="performance-panel">
                <SectionHeader
                  title={tr('investment_analytics:performance_63c904')}
                  detail={`${formatDate(performance.data.start)} - ${formatDate(asOf)}`}
                />
                <div className="investment-metrics">
                  <div>
                    <div className="metadata">
                      {tr('investment_analytics:ending_portfolio_value_f85721')}
                    </div>
                    <NullableMoney
                      minorUnits
                      value={performance.data.ending_value}
                      currency={currency}
                    />
                  </div>
                  <div>
                    <div className="metadata">
                      {tr('investment_analytics:time_weighted_return_5e454c')}
                      <MetricReasons reasons={performance.data.twr.reasons} />
                    </div>
                    <strong>{percent(performance.data.twr.value)}</strong>
                  </div>
                  <div>
                    <div className="metadata">
                      {tr('investment_analytics:xirr_annualized_cf8763')}
                      <MetricReasons reasons={performance.data.xirr.reasons} />
                    </div>
                    <strong>{percent(performance.data.xirr.value)}</strong>
                  </div>
                  <div>
                    <div className="metadata">
                      {tr('investment_analytics:period_gain_loss_d4939c')}
                      <MetricReasons
                        reasons={performance.data.absolute_gain.reasons}
                      />
                    </div>
                    <NullableMoney
                      minorUnits
                      value={performance.data.absolute_gain.value}
                      currency={currency}
                    />
                  </div>
                  <div>
                    <div className="metadata">
                      {tr('investment_analytics:net_external_funding_147c8c')}
                    </div>
                    <NullableMoney
                      minorUnits
                      value={performance.data.net_external_flows}
                      currency={currency}
                    />
                  </div>
                </div>
                <Suspense
                  fallback={
                    <LoadingState
                      text={tr(
                        'investment_analytics:loading_performance_chart__c84b9d',
                      )}
                    />
                  }
                >
                  {performance.data.points.filter(
                    (p) => p.return_percent !== null,
                  ).length > 1 ||
                  (performance.data.benchmark?.points.filter(
                    (p) => p.return_percent !== null,
                  ).length ?? 0) > 1 ? (
                    <PerformanceChart data={performance.data} />
                  ) : (
                    <EmptyState
                      title={tr(
                        'investment_analytics:no_return_history_available_cde23b',
                      )}
                      detail={tr(
                        'investment_analytics:choose_a_funded_period_with_eligible_cached_pric_7adef7',
                      )}
                    />
                  )}
                </Suspense>
              </div>
              <p className="metadata">
                {tr(
                  'investment_analytics:time_weighted_return_separates_investment_result_f7fa10',
                )}
              </p>
              {performance.data.benchmark && (
                <p className="metadata">
                  {' '}
                  {tr('investment_analytics:benchmark_return__32212f')}{' '}
                  {percent(performance.data.benchmark.return.value)}{' '}
                  {tr('investment_analytics:_difference__32db18')}{' '}
                  {performance.data.benchmark.difference_percentage_points ===
                  null
                    ? tr('dynamic:unavailable_2c9c1f')
                    : tr('messages:message_f48635fcb2cb', {
                        value0:
                          performance.data.benchmark
                            .difference_percentage_points,
                      })}{' '}
                  {tr(
                    'investment_analytics:_same_boundary_dates_and_reporting_currency__44934f',
                  )}{' '}
                  {performance.data.benchmark.source ??
                    tr('dynamic:no_eligible_source_089615')}{' '}
                  {tr('investment_analytics:_quote_680a0b')}{' '}
                  {performance.data.benchmark.quote_date ??
                    tr('dynamic:unavailable_1d5ee3')}{' '}
                  · {performance.data.benchmark.missing_days ?? 0}{' '}
                  {tr('investment_analytics:missing_days__f6d4b4')}{' '}
                  <Button variant="ghost" onClick={() => onSecurity(benchmark)}>
                    {tr('investment_analytics:open_benchmark_pricing_8bdca0')}
                  </Button>
                </p>
              )}
              <details className="chart-data">
                <summary>
                  {tr(
                    'investment_analytics:calculation_method_and_external_flows_d438f3',
                  )}
                </summary>
                <p className="metadata">
                  {tr(
                    'investment_analytics:daily_twr_treats_contributions_and_withdrawals_a_97d4e8',
                  )}
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr('investment_analytics:date_eb9a4b')}</th>
                        <th>{tr('investment_analytics:operation_430d32')}</th>
                        <th>
                          {tr('investment_analytics:original_amount_3ba05b')}
                        </th>
                        <th>
                          {tr('investment_analytics:reporting_amount_4875d7')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.data.flows.map((f) => (
                        <tr key={f.id}>
                          <td>{f.date}</td>
                          <td>{ui(f.type)}</td>
                          <td>
                            <Money value={f.amount} currency={f.currency} />
                          </td>
                          <td>
                            <NullableMoney
                              value={f.reporting_amount}
                              currency={currency}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              {insights.isError ? (
                <ErrorState
                  text={insights.error.message}
                  retry={() => void insights.refetch()}
                />
              ) : (
                insights.data && (
                  <PnL data={insights.data} onSecurity={onSecurity} />
                )
              )}
            </>
          )}
          {view === 'Income' && income.data && (
            <IncomeView
              data={income.data}
              start={period === 'ALL' ? '' : start}
              end={asOf}
              onSecurity={onSecurity}
            />
          )}
          {view === 'Allocation' && allocation.data && (
            <AllocationView
              data={allocation.data}
              insights={insights.data}
              onSecurity={onSecurity}
            />
          )}
        </>
      )}
    </section>
  )
}

function IncomeView({
  data,
  start,
  end,
  onSecurity,
}: {
  data: Income
  start: string
  end: string
  onSecurity: (id: string) => void
}) {
  const [group, setGroup] = useState('month')
  const route = useRoute()
  const selectedCurrency = route.params.get('income_currency') || ''
  const setSelectedCurrency = (income_currency: string) =>
    navigateTo('Investments', undefined, {
      ...Object.fromEntries(route.params),
      view: 'Income',
      income_currency,
    })
  const currencies = [...new Set(data.events.map((e) => e.currency))]
  const visibleCurrency = selectedCurrency || currencies[0]
  const summary = incomeSummary(data, visibleCurrency ?? 'BRL', start, end)
  const sources = (data.breakdowns.type ?? []).filter(
    (r) => r.currency === visibleCurrency,
  )
  const sourceTotal = decimalUnits(sumMoney(sources.map((r) => r.net)))
  const positiveSources =
    sourceTotal > 0n && sources.every((r) => decimalUnits(r.net) >= 0n)
  const grouped =
    group === 'month'
      ? data.months.map((m) => ({
          ...m,
          name: m.month,
          id: null as string | null,
        }))
      : data.breakdowns[group]
  if (!data.events.length && !data.redemptions?.length)
    return (
      <EmptyState
        title={tr(
          'investment_analytics:no_investment_income_in_this_period_c9d4c0',
        )}
        detail={tr(
          'investment_analytics:recorded_dividends_and_interest_appear_here_no_f_259800',
        )}
      />
    )
  return (
    <>
      <div className="income-summary-strip">
        <div>
          <small>{tr('parity:net_received')}</small>
          <Money
            value={summary.total}
            currency={visibleCurrency || 'BRL'}
            minorUnits
          />
          <div className="income-currency">
            <Field label={tr('parity:currency')}>
              <select
                value={visibleCurrency ?? ''}
                onChange={(e) => setSelectedCurrency(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <div>
          <small>{tr('parity:monthly_average')}</small>
          <Money
            value={summary.average}
            currency={visibleCurrency || 'BRL'}
            minorUnits
          />
          <p className="metadata">
            {summary.months} {tr('parity:calendar_months')}
          </p>
        </div>
        <div>
          <small>{tr('parity:income_sources')}</small>
          {sources.map((r, index) => (
            <div className="income-type-source" key={r.name}>
              <div>
                <span>{ui(r.name)}</span>
                <Money value={r.net} currency={r.currency} minorUnits />
              </div>
              {positiveSources && (
                <div className="income-type-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${Number((decimalUnits(r.net) * 10000n) / sourceTotal) / 100}%`,
                      background: `var(${['--chart-line', '--chart-secondary', '--chart-3', '--chart-4'][index % 4]})`,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {currencies
        .filter((c) => c === visibleCurrency)
        .map((c) => (
          <div className="income-visual-grid" key={c}>
            <Suspense
              fallback={
                <LoadingState
                  text={tr(
                    'investment_analytics:loading_income_history__8a54c1',
                  )}
                />
              }
            >
              <IncomeChart currency={c} rows={summary.rows} />
            </Suspense>
            <aside>
              <SectionHeader title={tr('parity:top_income_sources')} />
              <ol className="income-source-ranking">
                {(data.breakdowns.security ?? [])
                  .filter((r) => r.currency === c && decimalUnits(r.net) > 0n)
                  .sort((a, b) =>
                    decimalUnits(a.net) > decimalUnits(b.net) ? -1 : 1,
                  )
                  .slice(0, 10)
                  .map((r) => (
                    <li key={r.id ?? r.name}>
                      <button
                        disabled={!r.id}
                        onClick={() => r.id && onSecurity(r.id)}
                      >
                        {r.name}
                      </button>
                      <Money value={r.net} currency={c} minorUnits />
                    </li>
                  ))}
              </ol>
            </aside>
          </div>
        ))}
      <p className="metadata income-average-context">
        {tr('parity:income_average_context')}
      </p>
      <p className="metadata">{tr('parity:accrual_not_income')}</p>
      {!!data.redemptions?.length && (
        <section>
          <SectionHeader title={tr('parity:redemption_results')} />
          <div className="table-scroll">
            <table className="investment-table">
              <thead>
                <tr>
                  {[
                    'Date',
                    'Account',
                    'Security',
                    'Principal',
                    'Gross',
                    'Taxes',
                    'Fees',
                    'Net',
                    'Realized P&L',
                  ].map((h) => (
                    <th key={h}>{ui(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.redemptions.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{r.account}</td>
                    <td>
                      <button
                        className="investment-security"
                        onClick={() => onSecurity(r.asset_id)}
                      >
                        {r.symbol}
                      </button>
                    </td>
                    {[
                      r.principal,
                      r.gross,
                      r.taxes,
                      r.fees,
                      r.net,
                      r.realized,
                    ].map((v, i) => (
                      <td className="number" key={i}>
                        <Money value={v} currency={r.currency} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="table-scroll">
        <table className="investment-table">
          <caption>
            <Field label={tr('investment_analytics:group_income_by_d0da5d')}>
              <select value={group} onChange={(e) => setGroup(e.target.value)}>
                {['month', 'year', 'account', 'security', 'type'].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Field>
          </caption>
          <thead>
            <tr>
              <th scope="col">
                {tr('investment_analytics:income_source_period_ff2463')}
              </th>
              <th scope="col">{tr('investment_analytics:gross_9580a6')}</th>
              <th scope="col">{tr('investment_analytics:fees_72abbc')}</th>
              <th scope="col">
                {tr('investment_analytics:withholding_taxes_6bce7a')}
              </th>
              <th scope="col">
                {tr('investment_analytics:net_income_84c5b8')}
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((m) => (
              <tr key={`${m.id ?? m.name}-${m.currency}`}>
                <td>
                  {group === 'security' && m.id ? (
                    <button
                      className="investment-security"
                      onClick={() => onSecurity(m.id!)}
                    >
                      {m.name}
                    </button>
                  ) : (
                    m.name
                  )}{' '}
                  · {m.currency}
                </td>
                {[m.gross, m.fees, m.taxes, m.net].map((v, i) => (
                  <td key={i} className="number">
                    <Money value={v} currency={m.currency} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-scroll">
        <table className="investment-table">
          <caption>
            {tr('investment_analytics:income_activities_dbccc4')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{tr('investment_analytics:date_eb9a4b')}</th>
              <th scope="col">{tr('investment_analytics:account_85dfa3')}</th>
              <th scope="col">
                {tr('investment_analytics:type_security_1ffd1d')}
              </th>
              <th scope="col">{tr('investment_analytics:gross_9580a6')}</th>
              <th scope="col">{tr('investment_analytics:fees_72abbc')}</th>
              <th scope="col">{tr('investment_analytics:taxes_7e36e3')}</th>
              <th scope="col">{tr('investment_analytics:net_9bb81c')}</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{e.account}</td>
                <td>
                  {e.asset_id ? (
                    <button
                      className="investment-security"
                      onClick={() => onSecurity(e.asset_id!)}
                    >
                      {e.symbol} · {ui(e.type)}
                    </button>
                  ) : (
                    e.type
                  )}
                </td>
                {[e.gross, e.fees, e.taxes, e.net].map((v, i) => (
                  <td className="number" key={i}>
                    <Money value={v} currency={e.currency} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function AllocationView({
  data,
  insights,
  onSecurity,
}: {
  data: Allocation
  insights?: Insights
  onSecurity: (id: string) => void
}) {
  const [dimension, setDimension] = useState('security')
  const [expanded, setExpanded] = useState('')
  const cash = data.rows?.filter((r) => r.asset_id === null)
  const invested = data.rows?.filter((r) => r.asset_id !== null)
  const total = (rows: typeof cash) =>
    !rows || rows.some((r) => r.value === null)
      ? null
      : sumMoney(rows.map((r) => r.value!))
  return (
    <>
      <div className="investment-metrics allocation-summary">
        <div>
          <span className="metadata">
            {tr('market_data:portfolio_value_73adb8')}
          </span>
          <NullableMoney
            minorUnits
            value={data.total_value}
            currency={data.currency}
          />
        </div>
        <div>
          <span className="metadata">{tr('parity:cash')}</span>
          <NullableMoney
            minorUnits
            value={total(cash)}
            currency={data.currency}
          />
        </div>
        <div>
          <span className="metadata">{tr('parity:invested')}</span>
          <NullableMoney
            minorUnits
            value={total(invested)}
            currency={data.currency}
          />
        </div>
      </div>
      {data.quality !== 'COMPLETE' && (
        <p role="status">
          {' '}
          {tr(
            'investment_analytics:incomplete_valuation_known_subtotal_8b566e',
          )}{' '}
          <Money value={data.known_value} currency={data.currency} />{' '}
          {tr('investment_analytics:_weights_unavailable_f6e61d')}{' '}
        </p>
      )}
      <div className="exposure-grid">
        {['account', 'asset_class', 'geography', 'sector']
          .filter((key) => data.groups[key])
          .map((key) => (
            <CompositionChart
              key={key}
              compact
              title={ui(key.replaceAll('_', ' '))}
              currency={data.currency}
              complete={data.quality === 'COMPLETE'}
              items={data.groups[key].map((g) => ({
                name: key === 'asset_class' ? ui(g.name) : g.name,
                value: g.value,
                weight: g.weight_percent,
              }))}
              onSelect={(item) => {
                setDimension(key)
                setExpanded(item.name)
              }}
            />
          ))}
      </div>
      <div className="allocation-composition">
        <nav
          className="range-tabs allocation-dimensions"
          aria-label={tr('investment_analytics:allocation_dimension_c0ca3b')}
        >
          {Object.keys(data.groups).map((d) => (
            <button
              key={d}
              aria-pressed={dimension === d}
              onClick={() => {
                setDimension(d)
                setExpanded('')
              }}
            >
              {ui(d.replaceAll('_', ' '))}
            </button>
          ))}
        </nav>

        <CompositionChart
          title={tr('investment_analytics:proportional_composition_b7dffb')}
          kind="treemap"
          currency={data.currency}
          complete={data.quality === 'COMPLETE'}
          items={(data.groups[dimension] ?? []).map((g) => ({
            name: g.name,
            value: g.value,
            weight: g.weight_percent,
          }))}
        />
      </div>
      {insights && (
        <details className="native-basis-details">
          <summary>{tr('parity:native_basis')}</summary>
          <div className="native-basis-strip">
            {[...new Set(insights.positions.map((p) => p.currency))].map(
              (currency) => {
                const positions = insights.positions.filter(
                  (p) => p.currency === currency,
                )
                return (
                  <div key={currency}>
                    <small>
                      {tr('parity:native_basis')} - {currency}
                    </small>
                    <Money
                      value={sumMoney(positions.map((p) => p.cost_basis))}
                      currency={currency}
                    />
                    <small>{tr('parity:native_unrealized')}</small>
                    <NullableMoney
                      value={
                        positions.some((p) => p.unrealized === null)
                          ? null
                          : sumMoney(positions.map((p) => p.unrealized!))
                      }
                      currency={currency}
                    />
                  </div>
                )
              },
            )}
          </div>
        </details>
      )}
      <div className="table-scroll">
        <table className="investment-table">
          <thead>
            <tr>
              <th scope="col">{tr('investment_analytics:exposure_862ee3')}</th>
              <th scope="col">{tr('investment_analytics:value_8dce17')}</th>
              <th scope="col">{tr('investment_analytics:weight_69c0b8')}</th>
              <th scope="col">
                {tr('investment_analytics:composition_ca5e00')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.groups[dimension]?.map((g) => (
              <tr key={g.name}>
                <td>
                  <button
                    className="investment-security"
                    aria-expanded={expanded === g.name}
                    onClick={() =>
                      setExpanded(expanded === g.name ? '' : g.name)
                    }
                  >
                    {g.name}
                  </button>
                  {expanded === g.name && (
                    <div>
                      {g.members.map((m, i) =>
                        m.asset_id ? (
                          <Button
                            key={i}
                            variant="ghost"
                            onClick={() => onSecurity(m.asset_id!)}
                          >
                            {tr('investment_analytics:view_security_ab14a2')}
                          </Button>
                        ) : (
                          <small key={i}>
                            {tr('investment_analytics:account_cash_99eb24')}
                          </small>
                        ),
                      )}
                    </div>
                  )}
                </td>
                <td className="number">
                  <NullableMoney value={g.value} currency={data.currency} />
                </td>
                <td className="number">{percent(g.weight_percent)}</td>
                <td>
                  {g.weight_percent !== null && (
                    <progress
                      aria-label={tr('messages:message_ab4f8cca6eab', {
                        value0: g.name,
                      })}
                      max={10000}
                      value={Number(decimalUnits(g.weight_percent) / 10000n)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionHeader title={tr('parity:concentration')} />
      <div className="investment-metrics">
        {Object.entries(data.concentration).map(([n, value]) => (
          <div key={n}>
            <small>
              {tr('investment_analytics:top_cae043')} {n}
            </small>
            <strong>{percent(value)}</strong>
          </div>
        ))}
      </div>
    </>
  )
}

function PnL({
  data,
  onSecurity,
}: {
  data: Insights
  onSecurity: (id: string) => void
}) {
  const [sort, setSort] = useState<
    'total_gain' | 'realized' | 'unrealized' | 'income' | 'market_value'
  >('total_gain')
  const [ascending, setAscending] = useState(false)
  const positions = [...data.positions].sort((a, b) => {
    if (a.currency !== b.currency) return a.currency.localeCompare(b.currency)
    const av = a[sort],
      bv = b[sort]
    if (av === null) return bv === null ? 0 : 1
    if (bv === null) return -1
    const difference = decimalUnits(av) - decimalUnits(bv)
    return difference === 0n
      ? a.symbol.localeCompare(b.symbol)
      : (difference > 0n ? 1 : -1) * (ascending ? 1 : -1)
  })
  return (
    <>
      <SectionHeader
        title={tr('investment_analytics:security_results_0266cb')}
        detail={tr(
          'investment_analytics:selected_period_realized_results_and_income_endi_a517df',
        )}
      />
      <p className="metadata">{data.warning}</p>
      <div className="investment-toolbar">
        <Field
          label={tr(
            'investment_analytics:rank_positions_within_currency_d8f045',
          )}
        >
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="total_gain">
              {tr('investment_analytics:period_gain_loss_d4939c')}
            </option>
            <option value="realized">
              {tr('investment_analytics:realized_result_a229ad')}
            </option>
            <option value="unrealized">
              {tr('investment_analytics:unrealized_result_4124e3')}
            </option>
            <option value="income">
              {tr('investment_analytics:income_generated_0085ee')}
            </option>
            <option value="market_value">
              {tr('investment_analytics:current_position_value_5acc8c')}
            </option>
          </select>
        </Field>
        <Field label={tr('investment_analytics:position_ranking_order_408669')}>
          <select
            value={ascending ? 'asc' : 'desc'}
            onChange={(e) => setAscending(e.target.value === 'asc')}
          >
            <option value="desc">
              {tr('investment_analytics:largest_best_first_e4d5d6')}
            </option>
            <option value="asc">
              {tr('investment_analytics:smallest_worst_first_1b3f9a')}
            </option>
          </select>
        </Field>
        <span className="metadata">
          {tr(
            'investment_analytics:absolute_amounts_within_each_original_currency_n_00c9a6',
          )}
        </span>
      </div>
      <div className="table-scroll">
        <table className="investment-table">
          <thead>
            <tr>
              {[
                'Security',
                'Position value',
                'Realized',
                'Unrealized',
                'Net income',
                'Recorded fees',
                'Recorded taxes',
                'Period gain',
                'FX effect',
              ].map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <tr key={i}>
                <td>
                  {p.asset_id ? (
                    <button
                      className="investment-security"
                      onClick={() => onSecurity(p.asset_id!)}
                    >
                      {p.symbol}
                    </button>
                  ) : (
                    p.symbol
                  )}
                  <small>
                    {p.account} · {p.currency}
                    {decimalUnits(p.quantity) === 0n
                      ? tr('dynamic:_closed_cash_f23f50')
                      : ''}
                  </small>
                </td>
                {[
                  p.market_value,
                  p.realized,
                  p.unrealized,
                  p.income,
                  p.fees,
                  p.taxes,
                  p.total_gain,
                ].map((v, k) => (
                  <td className="number" key={k}>
                    <NullableMoney value={v} currency={p.currency} />
                  </td>
                ))}
                <td className="number">
                  <NullableMoney
                    value={p.fx_contribution.value}
                    currency={data.currency}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="chart-data">
        <summary>
          {tr('investment_analytics:investment_activity_trends_2e9ef8')}
        </summary>
        <div className="table-scroll">
          <table className="investment-table">
            <thead>
              <tr>
                <th scope="col">{tr('investment_analytics:month_082bc3')}</th>
                <th scope="col">
                  {tr('investment_analytics:activity_81c0d9')}
                </th>
                <th scope="col">
                  {tr('investment_analytics:recorded_count_0f8b5e')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.activity_trends.map((row) => (
                <tr key={`${row.month}-${row.type}`}>
                  <td>{row.month}</td>
                  <td>{ui(row.type)}</td>
                  <td className="number">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  )
}

export function SecurityResults({
  id,
  accountId,
  asOf,
  onSecurity,
}: {
  id: string
  accountId: string
  asOf: string
  onSecurity: (id: string) => void
}) {
  const params = `${analyticsParams(startDate('1Y', asOf, ''), asOf, 'BRL', accountId)}&asset_id=${encodeURIComponent(id)}`
  const query = useQuery({
    queryKey: ['investment-insights', params],
    queryFn: ({ signal }) => getInsights(params, signal),
  })
  return (
    <section aria-label={tr('investment_analytics:security_analytics_77eaa2')}>
      <p className="metadata">
        {tr(
          'investment_analytics:security_results_last_year_fx_effect_in_brl_orig_9a0b09',
        )}
      </p>
      {query.isPending ? (
        <LoadingState
          text={tr('investment_analytics:calculating_security_results__c9d932')}
        />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <PnL data={query.data} onSecurity={onSecurity} />
      )}
    </section>
  )
}

export function SecurityClassification({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['asset-classification', id],
    queryFn: async ({ signal }) =>
      classificationSchema.parse(
        await request(`/investments/analytics/assets/${id}/classification`, {
          signal,
        }),
      ),
  })
  const write = useWrite()
  return (
    <details className="chart-data">
      <summary>
        {tr('investment_analytics:sector_and_geographic_classification_2b3aa8')}
      </summary>
      <p className="metadata">
        {tr(
          'investment_analytics:explicit_metadata_only_leave_blank_for_unknown_f_f626a2',
        )}
      </p>
      {query.data && (
        <form
          className="investment-editor"
          key={JSON.stringify(query.data)}
          onSubmit={(e) => {
            e.preventDefault()
            const form = exactFormData(e.currentTarget)
            write.mutate({
              path: `/investments/analytics/assets/${id}/classification`,
              method: 'PUT',
              data: {
                sector: String(form.get('sector') ?? ''),
                geography: String(form.get('geography') ?? ''),
              },
            })
          }}
        >
          <Field label={tr('investment_analytics:sector_39fd20')}>
            <input
              name="sector"
              maxLength={100}
              defaultValue={query.data.sector ?? ''}
            />
          </Field>
          <Field label={tr('investment_analytics:geography_77fc62')}>
            <input
              name="geography"
              maxLength={100}
              defaultValue={query.data.geography ?? ''}
            />
          </Field>
          <Button disabled={write.isPending}>
            {tr('investment_analytics:save_classification_96a7d5')}
          </Button>
        </form>
      )}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {write.isError && <p role="alert">{write.error.message}</p>}
    </details>
  )
}
