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
import { decimalUnits, sumMoney } from '@/lib/money'
import { useWrite } from '@/lib/use-write'

const PerformanceChart = lazy(() => import('@/components/performance-chart'))
const IncomeChart = lazy(() => import('@/components/income-chart'))
const periods = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL', 'Custom']

export function NullableMoney({
  value,
  currency,
}: {
  value: string | null
  currency: string
}) {
  return value === null ? (
    <span className="metadata">Unavailable</span>
  ) : (
    <Money value={value} currency={currency} />
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
    <section aria-label="Investment return summary">
      <div className="investment-toolbar">
        <span className="metadata">
          Last 3 months · BRL reporting · Cash-flow-adjusted
        </span>
        <Button variant="ghost" onClick={onOpen}>
          Explore performance
        </Button>
      </div>
      {query.data ? (
        <div className="investment-metrics">
          <div>
            <span className="metadata">Time-weighted return</span>
            {percent(query.data.twr.value)}
          </div>
          <div>
            <span className="metadata">XIRR · annualized</span>
            {percent(query.data.xirr.value)}
          </div>
          <div>
            <span className="metadata">Period gain / loss</span>
            <NullableMoney
              value={query.data.absolute_gain.value}
              currency="BRL"
            />
          </div>
        </div>
      ) : query.isError ? (
        <p className="metadata">
          Performance unavailable. Open Performance to inspect coverage.
        </p>
      ) : (
        <LoadingState text="Calculating returns…" />
      )}
    </section>
  )
}

export default function InvestmentAnalytics({
  view,
  accountId,
  asOf,
  onSecurity,
}: {
  view: string
  accountId: string
  asOf: string
  onSecurity: (id: string) => void
}) {
  const [period, setPeriod] = useState('3M')
  const [custom, setCustom] = useState(asOf.slice(0, 8) + '01')
  const [currency, setCurrency] = useState('BRL')
  const [benchmark, setBenchmark] = useState('')
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
    enabled: view === 'Performance',
  })
  const query =
    view === 'Performance'
      ? performance
      : view === 'Income'
        ? income
        : allocation
  return (
    <section aria-label={`Investment ${view.toLowerCase()}`}>
      <div className="investment-toolbar">
        {view !== 'Allocation' && (
          <nav className="range-tabs" aria-label="Analytics period">
            {periods.map((p) => (
              <button
                key={p}
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </nav>
        )}
        {period === 'Custom' && view !== 'Allocation' && (
          <Field label="Period opening date">
            <input
              type="date"
              value={custom}
              max={asOf}
              onChange={(e) => setCustom(e.target.value)}
            />
          </Field>
        )}
        {view !== 'Income' && (
          <Field label="Analytics currency">
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
          <Field label="Benchmark">
            <select
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value)}
            >
              <option value="">No benchmark</option>
              {assets.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} · {a.currency} price proxy
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {query.isPending ? (
        <LoadingState text="Calculating investment analytics…" />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          {view === 'Performance' && performance.data && (
            <>
              <SectionHeader
                title="Performance"
                detail={`${performance.data.start} – ${asOf} · Closing-value boundaries · ${currency}`}
              />
              <div className="investment-metrics">
                <div>
                  <span className="metadata">Ending portfolio value</span>
                  <NullableMoney
                    value={performance.data.ending_value}
                    currency={currency}
                  />
                </div>
                <div>
                  <span className="metadata">Time-weighted return</span>
                  <strong>{percent(performance.data.twr.value)}</strong>
                </div>
                <div>
                  <span className="metadata">XIRR · annualized</span>
                  <strong>{percent(performance.data.xirr.value)}</strong>
                </div>
                <div>
                  <span className="metadata">Period gain / loss</span>
                  <NullableMoney
                    value={performance.data.absolute_gain.value}
                    currency={currency}
                  />
                </div>
                <div>
                  <span className="metadata">Net external funding</span>
                  <NullableMoney
                    value={performance.data.net_external_flows}
                    currency={currency}
                  />
                </div>
              </div>
              {[
                performance.data.twr,
                performance.data.xirr,
                performance.data.absolute_gain,
              ].some((m) => m.reasons.length > 0) && (
                <p role="status" className="metadata">
                  {[
                    ...new Set(
                      [
                        performance.data.twr,
                        performance.data.xirr,
                        performance.data.absolute_gain,
                      ].flatMap((m) => m.reasons),
                    ),
                  ]
                    .map((r) => r.replaceAll('_', ' ').toLowerCase())
                    .join(' · ')}
                </p>
              )}
              <Suspense
                fallback={<LoadingState text="Loading performance chart…" />}
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
                    title="No return history available"
                    detail="Choose a funded period with eligible cached prices and FX. Missing returns are never plotted as zero."
                  />
                )}
              </Suspense>
              {performance.data.benchmark && (
                <p className="metadata">
                  Benchmark return:{' '}
                  {percent(performance.data.benchmark.return.value)} ·
                  Difference:{' '}
                  {performance.data.benchmark.difference_percentage_points ===
                  null
                    ? 'Unavailable'
                    : `${performance.data.benchmark.difference_percentage_points} percentage points`}{' '}
                  · Same boundary dates and reporting currency.{' '}
                  {performance.data.benchmark.source ?? 'No eligible source'} ·
                  Quote {performance.data.benchmark.quote_date ?? 'unavailable'}{' '}
                  · {performance.data.benchmark.missing_days ?? 0} missing days.
                  <Button variant="ghost" onClick={() => onSecurity(benchmark)}>
                    Open benchmark pricing
                  </Button>
                </p>
              )}
              <details className="chart-data">
                <summary>Calculation method and external flows</summary>
                <p className="metadata">
                  Daily TWR treats contributions and withdrawals at end of day.
                  The opening date is a closing-value boundary; later flows are
                  included. XIRR uses actual dates / 365 and is annualized even
                  for short periods. Missing daily values invalidate TWR;
                  missing endpoints or flow FX invalidate XIRR.
                  Multiple-sign-change cash flows are conservatively unavailable
                  because roots may be ambiguous. Returns include recorded fees
                  and taxes.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Operation</th>
                        <th>Original amount</th>
                        <th>Reporting amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.data.flows.map((f) => (
                        <tr key={f.id}>
                          <td>{f.date}</td>
                          <td>{f.type}</td>
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
            <IncomeView data={income.data} onSecurity={onSecurity} />
          )}
          {view === 'Allocation' && allocation.data && (
            <AllocationView data={allocation.data} onSecurity={onSecurity} />
          )}
        </>
      )}
    </section>
  )
}

function IncomeView({
  data,
  onSecurity,
}: {
  data: Income
  onSecurity: (id: string) => void
}) {
  const [group, setGroup] = useState('month')
  const currencies = [...new Set(data.events.map((e) => e.currency))]
  const grouped =
    group === 'month'
      ? data.months.map((m) => ({
          ...m,
          name: m.month,
          id: null as string | null,
        }))
      : data.breakdowns[group]
  if (!data.events.length)
    return (
      <EmptyState
        title="No investment income in this period"
        detail="Recorded dividends and interest appear here; no future distributions are estimated."
      />
    )
  return (
    <>
      <SectionHeader
        title="Investment income"
        detail="Actual dividend and interest activities · Original currencies · No projected yield"
      />
      <div className="investment-metrics">
        {currencies.map((c) => (
          <div key={c}>
            <span className="metadata">Net income · {c}</span>
            <Money
              value={sumMoney(
                data.events.filter((e) => e.currency === c).map((e) => e.net),
              )}
              currency={c}
            />
          </div>
        ))}
      </div>
      {currencies.map((c) => (
        <Suspense
          key={c}
          fallback={<LoadingState text="Loading income history…" />}
        >
          <IncomeChart
            currency={c}
            rows={data.months.filter((m) => m.currency === c)}
          />
        </Suspense>
      ))}
      <div className="table-scroll">
        <table className="investment-table">
          <caption>
            <Field label="Group income by">
              <select value={group} onChange={(e) => setGroup(e.target.value)}>
                {['month', 'year', 'account', 'security', 'type'].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Field>
          </caption>
          <thead>
            <tr>
              <th scope="col">Income source / period</th>
              <th scope="col">Gross</th>
              <th scope="col">Fees</th>
              <th scope="col">Withholding / taxes</th>
              <th scope="col">Net income</th>
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
          <caption>Income activities</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Account</th>
              <th scope="col">Type / security</th>
              <th scope="col">Gross</th>
              <th scope="col">Fees</th>
              <th scope="col">Taxes</th>
              <th scope="col">Net</th>
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
                      {e.symbol} · {e.type}
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
  onSecurity,
}: {
  data: Allocation
  onSecurity: (id: string) => void
}) {
  const [dimension, setDimension] = useState('security')
  const [expanded, setExpanded] = useState('')
  return (
    <>
      <SectionHeader
        title="Portfolio composition"
        detail={data.metadata_policy}
      />
      <div className="investment-metrics">
        <div>
          <span className="metadata">Cash + holdings</span>
          <NullableMoney value={data.total_value} currency={data.currency} />
        </div>
        {Object.entries(data.concentration).map(([n, v]) => (
          <div key={n}>
            <span className="metadata">Top {n} securities / portfolio</span>
            {percent(v)}
          </div>
        ))}
      </div>
      {data.quality !== 'COMPLETE' && (
        <p role="status">
          Incomplete valuation · Known subtotal{' '}
          <Money value={data.known_value} currency={data.currency} /> · Weights
          unavailable
        </p>
      )}
      <nav className="range-tabs" aria-label="Allocation dimension">
        {Object.keys(data.groups).map((d) => (
          <button
            key={d}
            aria-pressed={dimension === d}
            onClick={() => {
              setDimension(d)
              setExpanded('')
            }}
          >
            {d.replaceAll('_', ' ')}
          </button>
        ))}
      </nav>
      <div className="table-scroll">
        <table className="investment-table">
          <thead>
            <tr>
              <th scope="col">Exposure</th>
              <th scope="col">Value</th>
              <th scope="col">Weight</th>
              <th scope="col">Composition</th>
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
                            View security
                          </Button>
                        ) : (
                          <small key={i}>Account cash</small>
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
                      aria-label={`${g.name} allocation`}
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
        title="Security results"
        detail="Selected-period realized results and income · Ending unrealized results · Original currencies"
      />
      <p className="metadata">{data.warning}</p>
      <div className="investment-toolbar">
        <Field label="Rank positions within currency">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="total_gain">Period gain / loss</option>
            <option value="realized">Realized result</option>
            <option value="unrealized">Unrealized result</option>
            <option value="income">Income generated</option>
            <option value="market_value">Current position value</option>
          </select>
        </Field>
        <Field label="Position ranking order">
          <select
            value={ascending ? 'asc' : 'desc'}
            onChange={(e) => setAscending(e.target.value === 'asc')}
          >
            <option value="desc">Largest / best first</option>
            <option value="asc">Smallest / worst first</option>
          </select>
        </Field>
        <span className="metadata">
          Absolute amounts within each original currency, not time-weighted
          security returns.
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
                    {decimalUnits(p.quantity) === 0n ? ' · Closed / cash' : ''}
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
        <summary>Investment activity trends</summary>
        <div className="table-scroll">
          <table className="investment-table">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Activity</th>
                <th scope="col">Recorded count</th>
              </tr>
            </thead>
            <tbody>
              {data.activity_trends.map((row) => (
                <tr key={`${row.month}-${row.type}`}>
                  <td>{row.month}</td>
                  <td>{row.type}</td>
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
    <section aria-label="Security analytics">
      <p className="metadata">
        Security results · Last year · FX effect in BRL · Original-currency
        P&amp;L
      </p>
      {query.isPending ? (
        <LoadingState text="Calculating security results…" />
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
      <summary>Sector and geographic classification</summary>
      <p className="metadata">
        Explicit metadata only. Leave blank for Unknown. Fund holdings are not
        looked through.
      </p>
      {query.data && (
        <form
          className="investment-editor"
          key={JSON.stringify(query.data)}
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
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
          <Field label="Sector">
            <input
              name="sector"
              maxLength={100}
              defaultValue={query.data.sector ?? ''}
            />
          </Field>
          <Field label="Geography">
            <input
              name="geography"
              maxLength={100}
              defaultValue={query.data.geography ?? ''}
            />
          </Field>
          <Button disabled={write.isPending}>Save classification</Button>
        </form>
      )}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {write.isError && <p role="alert">{write.error.message}</p>}
    </details>
  )
}
