import { useReportingCurrency } from '@/features/settings/reporting-currency'
import { demoChartLabel } from '@/lib/demo-runtime'
import { reportedIncome } from '@/lib/investment-analytics'
import {
  isSimulatedInvestmentScenario,
  useDemoRuntime,
} from '@/lib/demo-runtime'
import { analyticsPeriods } from '@/lib/investment-analytics'
import { incomePeriod } from '@/lib/income-dashboard'
import { ReceivedIncomeDashboard } from '@/components/income-dashboard'
import { AccruedIncomeDashboard } from '@/components/accrued-income-dashboard'
import { MotionChoice } from '@/components/selection-indicator'
import { useSelectionId } from '@/lib/motion'
import { useRoute, navigateTo } from '@/lib/navigation'
import { t as tr, ui } from '@/lib/i18n'
import { exactFormData } from '@/lib/localized-number'
import { PortfolioInsightsOverview } from '@/components/portfolio-insights-overview'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import {
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
  type Income,
  type Insights,
} from '@/lib/investment-analytics'
import { getAssets } from '@/lib/investments'
import { request } from '@/lib/api'
import { decimalUnits, formatDate } from '@/lib/money'
import { useWrite } from '@/lib/use-write'

const PerformanceWorkspace = lazy(() =>
  import('@/features/performance/performance-workspace').then((m) => ({
    default: m.PerformanceWorkspace,
  })),
)

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
  onCustomizeActionChange,
}: {
  externalRangeControls?: boolean
  view: string
  accountId: string
  asOf: string
  onSecurity: (id: string) => void
  onCustomizeActionChange?: (action: ReactNode | null) => void
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
  const reportingCurrency = useReportingCurrency()
  const currency = route.params.get('currency') || reportingCurrency
  const benchmark = route.params.get('benchmark') || ''
  const setBenchmark = (benchmark: string) => update({ benchmark })
  const incomeRange = incomePeriod(period, asOf, custom)
  const start =
    view === 'Income' ? incomeRange.start : startDate(period, asOf, custom)
  const params = analyticsParams(
    period === 'ALL' && view === 'Performance' ? '' : start,
    view === 'Income' ? incomeRange.end : asOf,
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
  const previousIncomeParams = analyticsParams(
    incomeRange.previousStart,
    incomeRange.previousEnd,
    currency,
    accountId,
  )
  const previousIncome = useQuery({
    queryKey: ['investment-income', previousIncomeParams],
    queryFn: ({ signal }) => getIncome(previousIncomeParams, signal),
    enabled: view === 'Income' && period !== 'ALL',
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
              <Suspense
                fallback={
                  <LoadingState
                    text={tr(
                      'investment_analytics:loading_performance_chart__c84b9d',
                    )}
                  />
                }
              >
                <PerformanceWorkspace
                  key={`${accountId}-${asOf}`}
                  data={performance.data}
                  accountId={accountId}
                  benchmarkId={benchmark}
                  onSecurity={onSecurity}
                />
              </Suspense>
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
              previous={previousIncome.data}
              period={period}
              accountId={accountId}
              securityNames={Object.fromEntries(
                (assets.data ?? []).map((asset) => [asset.id, asset.name]),
              )}
              start={period === 'ALL' ? '' : start}
              end={incomeRange.end}
              onSecurity={onSecurity}
            />
          )}
          {view === 'Allocation' && allocation.data && (
            <PortfolioInsightsOverview
              key={params}
              data={allocation.data}
              asOf={asOf}
              accountId={accountId}
              insights={insights.data}
              onSecurity={onSecurity}
              onCustomizeActionChange={onCustomizeActionChange}
            />
          )}
        </>
      )}
    </section>
  )
}

function IncomeView({
  data,
  previous,
  start,
  end,
  period,
  accountId,
  securityNames,
  onSecurity,
}: {
  data: Income
  previous?: Income
  start: string
  end: string
  period: string
  accountId: string
  securityNames?: Record<string, string>
  onSecurity: (id: string) => void
}) {
  const { runtime } = useDemoRuntime()
  const [group, setGroup] = useState('month')
  const route = useRoute()
  const update = (values: Record<string, string>) =>
    navigateTo('Investments', undefined, {
      ...Object.fromEntries(route.params),
      view: 'Income',
      ...values,
    })
  const currencies = [
    ...new Set([
      'BRL',
      ...data.events.map((event) => event.currency),
      ...(previous?.events.map((event) => event.currency) ?? []),
      ...(/^[A-Z]{3}$/.test(route.params.get('income_currency') ?? '')
        ? [route.params.get('income_currency')!]
        : []),
    ]),
  ]
  const visibleCurrency = currencies.includes(
    route.params.get('income_currency') ?? '',
  )
    ? route.params.get('income_currency')!
    : data.events[0]?.currency || 'BRL'
  const accrued = route.params.get('income_mode') === 'accrued'
  const reporting =
    !!data.reporting && route.params.get('income_basis') !== 'native'
  const converted = reporting ? reportedIncome(data) : undefined
  const convertedPrevious =
    reporting && previous ? reportedIncome(previous) : undefined
  const visible = (row: { currency: string }) =>
    reporting || row.currency === visibleCurrency

  const grouped = (
    group === 'month'
      ? data.months.map((month) => ({
          ...month,
          name: month.month,
          id: null as string | null,
        }))
      : (data.breakdowns[group] ?? [])
  ).filter(visible)
  return (
    <>
      <div className="income-view-toolbar">
        <nav
          className="income-view-tabs"
          aria-label={tr('income_dashboard:income_view')}
        >
          <button
            aria-pressed={!accrued}
            onClick={() => update({ income_mode: 'received' })}
          >
            {tr('income_dashboard:received')}
          </button>
          <button
            aria-pressed={accrued}
            onClick={() => update({ income_mode: 'accrued' })}
          >
            {tr('income_dashboard:accrued')}
          </button>
        </nav>
        {runtime?.scenario !== 'unified' &&
          isSimulatedInvestmentScenario(runtime?.scenario) && (
            <span className="metadata">
              {tr(demoChartLabel(runtime?.scenario))}
            </span>
          )}
      </div>
      {accrued ? (
        <AccruedIncomeDashboard
          asOf={end}
          start={start || startDate('ALL', end, '')}
          accountId={accountId}
          onSecurity={onSecurity}
        />
      ) : (
        <>
          {reporting && !converted ? (
            <section className="income-source-card" role="status">
              <h3>{tr('income_dashboard:report_unavailable')}</h3>
              <p>
                {tr('income_dashboard:missing_fx')}{' '}
                {data.reporting!.missing_currencies.join(', ')}
              </p>
              <p className="metadata">
                {tr('income_dashboard:known_subtotal')}{' '}
                <Money
                  value={data.reporting!.known_net}
                  currency={data.reporting!.currency}
                />
              </p>
              <p className="metadata">{tr('income_dashboard:fx_definition')}</p>
            </section>
          ) : (
            <ReceivedIncomeDashboard
              data={converted ?? data}
              previous={reporting ? convertedPrevious : previous}
              report={reporting ? (data.reporting ?? undefined) : undefined}
              period={period}
              currency={reporting ? data.reporting!.currency : visibleCurrency}
              start={start}
              end={end}
              onAccrued={() => update({ income_mode: 'accrued' })}
              onSecurity={onSecurity}
              securityNames={securityNames}
            />
          )}
          {reporting && !!data.reporting?.events.length && (
            <details>
              <summary>{tr('income_dashboard:fx_details')}</summary>
              <p className="metadata">{tr('income_dashboard:fx_definition')}</p>
              <div className="table-scroll">
                <table className="investment-table">
                  <thead>
                    <tr>
                      <th>{tr('investment_analytics:date_eb9a4b')}</th>
                      <th>{tr('investment_analytics:account_85dfa3')}</th>
                      <th>{tr('income_dashboard:native')}</th>
                      <th>{tr('income_dashboard:reporting')}</th>
                      <th>{tr('income_dashboard:fx_source')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reporting.events.map((event) => (
                      <tr key={event.id}>
                        <td>{formatDate(event.date)}</td>
                        <td>{event.account}</td>
                        <td className="number">
                          <Money
                            value={event.original.net}
                            currency={event.original.currency}
                          />
                        </td>
                        <td className="number">
                          <NullableMoney
                            value={event.net}
                            currency={event.currency}
                          />
                        </td>
                        <td>
                          {event.fx
                            ? `${event.fx.provider} · ${formatDate(event.fx.date)}`
                            : tr('common:unavailable')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          {!!data.redemptions?.some((row) => visible(row)) && (
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
                    {data.redemptions.filter(visible).map((r) => (
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
          {data.events.some(visible) && (
            <>
              {reporting && (
                <p className="metadata">
                  {tr('income_dashboard:original_details')}
                </p>
              )}
              <div className="table-scroll">
                <table className="investment-table">
                  <caption>
                    <Field
                      label={tr('investment_analytics:group_income_by_d0da5d')}
                    >
                      <select
                        value={group}
                        onChange={(e) => setGroup(e.target.value)}
                      >
                        {['month', 'year', 'account', 'security', 'type'].map(
                          (g) => (
                            <option key={g}>{g}</option>
                          ),
                        )}
                      </select>
                    </Field>
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        {tr('investment_analytics:income_source_period_ff2463')}
                      </th>
                      <th scope="col">
                        {tr('investment_analytics:gross_9580a6')}
                      </th>
                      <th scope="col">
                        {tr('investment_analytics:fees_72abbc')}
                      </th>
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
                      <th scope="col">
                        {tr('investment_analytics:date_eb9a4b')}
                      </th>
                      <th scope="col">
                        {tr('investment_analytics:account_85dfa3')}
                      </th>
                      <th scope="col">
                        {tr('investment_analytics:type_security_1ffd1d')}
                      </th>
                      <th scope="col">
                        {tr('investment_analytics:gross_9580a6')}
                      </th>
                      <th scope="col">
                        {tr('investment_analytics:fees_72abbc')}
                      </th>
                      <th scope="col">
                        {tr('investment_analytics:taxes_7e36e3')}
                      </th>
                      <th scope="col">
                        {tr('investment_analytics:net_9bb81c')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.filter(visible).map((e) => (
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
          )}
        </>
      )}
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
