import { useDemoRuntime } from '@/lib/demo-runtime'
import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
  SectionHeader,
} from '@/components/primitives'
import {
  getAssetMarket,
  getMarketHistory,
  getMarketStatus,
  getReportingValue,
  getSecurityHistory,
  syncResultSchema,
  type assetMarketSchema,
} from '@/lib/market-data'
import { useWrite } from '@/lib/use-write'
import type { z } from 'zod'

const ValueChart = lazy(() =>
  import('@/components/portfolio-value-chart').then((m) => ({
    default: m.PortfolioValueChart,
  })),
)

export function RefreshMarket({
  assetId,
  backfill = false,
}: {
  assetId?: string
  backfill?: boolean
}) {
  const mutation = useWrite()
  const [force, setForce] = useState(false)
  const [start, setStart] = useState('')
  const outcome = syncResultSchema.safeParse(mutation.data)
  const { runtime } = useDemoRuntime()
  if (runtime)
    return (
      <p className="metadata">
        Synthetic cached history. External refresh disabled in this demo.
      </p>
    )
  return (
    <div className="investment-toolbar">
      {backfill && (
        <Field label="Backfill from">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
      )}
      <label className="metadata">
        <input
          type="checkbox"
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
        />{' '}
        Force refresh (provider limits still apply)
      </label>
      <Button
        variant="outline"
        disabled={mutation.isPending}
        onClick={() =>
          mutation.mutate({
            path: '/market-data/sync',
            data: {
              ...(assetId ? { asset_id: assetId } : {}),
              ...(start ? { start } : {}),
              force,
              include_fx: !assetId,
            },
          })
        }
      >
        {mutation.isPending
          ? 'Refreshing…'
          : assetId
            ? 'Refresh security'
            : 'Refresh market data'}
      </Button>
      {mutation.error && <ErrorState text={mutation.error.message} />}
      {mutation.isSuccess && (
        <p role="status" className="metadata">
          Refresh finished. Check provider status and coverage below;
          unavailable data remains cached.
          {outcome.success && (
            <>
              {' '}
              {outcome.data.results
                .map(
                  (r) =>
                    `${r.status.replaceAll('_', ' ').toLowerCase()} (${r.observations})`,
                )
                .join(' · ')}
            </>
          )}
        </p>
      )}
    </div>
  )
}

export function MarketDataSettings() {
  const query = useQuery({
    queryKey: ['market-data', 'status'],
    queryFn: getMarketStatus,
  })
  const mutation = useWrite()
  if (query.isPending)
    return <LoadingState text="Loading market-data settings…" />
  if (query.isError)
    return (
      <ErrorState
        text={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  const data = query.data
  return (
    <>
      <PageHeader
        title="Market Data"
        description="Local price cache · Optional provider synchronization"
      />
      <div className="investment-toolbar">
        <Field label="Reporting currency">
          <select
            value={data.settings.reporting_currency}
            onChange={(e) =>
              mutation.mutate({
                path: '/market-data/settings',
                method: 'PUT',
                data: { ...data.settings, reporting_currency: e.target.value },
              })
            }
          >
            {['BRL', 'USD', 'EUR', 'JPY'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="FX source">
          <select
            value={data.settings.fx_provider}
            onChange={(e) =>
              mutation.mutate({
                path: '/market-data/settings',
                method: 'PUT',
                data: { ...data.settings, fx_provider: e.target.value },
              })
            }
          >
            <option value="ECB">ECB reference rates</option>
            <option value="SYNTHETIC">Synthetic demo only</option>
          </select>
        </Field>
        <label>
          <input
            type="checkbox"
            checked={data.settings.automatic}
            disabled={mutation.isPending}
            onChange={(e) =>
              mutation.mutate({
                path: '/market-data/settings',
                method: 'PUT',
                data: { ...data.settings, automatic: e.target.checked },
              })
            }
          />{' '}
          Enable automatic refresh while the API is running
        </label>
      </div>
      <p className="metadata">
        Automatic refresh checks every {data.interval_minutes} minutes. Cached
        views work offline. Credentials stay in the backend environment;
        restarting the API reloads them.
      </p>
      <RefreshMarket />
      {mutation.error && <ErrorState text={mutation.error.message} />}
      <SectionHeader
        title="Providers"
        detail="Only symbols and requested dates are sent to providers. Account balances and activities stay local."
      />
      <div className="table-scroll">
        <table className="investment-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Configuration</th>
              <th>Coverage and limits</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>
                  {p.configured
                    ? 'Available configuration'
                    : 'API key not configured'}
                </td>
                <td>{p.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="metadata">
        Configure BRAPI_API_TOKEN and ALPHA_VANTAGE_API_KEY in the local .env
        file. Never paste credentials into this interface. Brapi raw history
        requires BRAPI_RAW_HISTORY=true and an eligible plan.
      </p>
      <SectionHeader
        title="Synchronization status"
        detail="Provider failures never delete cached observations."
      />
      {!data.sync.length ? (
        <EmptyState
          title="No synchronization yet"
          detail="Refresh supported securities to populate the local cache."
        />
      ) : (
        <div className="table-scroll">
          <table className="investment-table">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Provider</th>
                <th>Last success</th>
                <th>Last attempt</th>
                <th>Status</th>
                <th>Coverage</th>
                <th>Retry after</th>
              </tr>
            </thead>
            <tbody>
              {data.sync.map((s) => (
                <tr key={s.scope}>
                  <td>
                    {s.scope === 'FX'
                      ? 'Exchange rates'
                      : (s.symbol ?? s.scope.slice(0, 8))}
                  </td>
                  <td>{s.provider}</td>
                  <td>{s.succeeded_at?.slice(0, 16) ?? 'Never'}</td>
                  <td>{s.attempted_at?.slice(0, 16) ?? 'Never'}</td>
                  <td>{s.error ?? 'Updated'}</td>
                  <td>
                    {s.first_date ?? '—'} / {s.last_date ?? '—'}
                  </td>
                  <td>{s.retry_at?.slice(0, 16) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function PricingForm({
  id,
  initial,
}: {
  id: string
  initial: z.infer<typeof assetMarketSchema>['pricing']
}) {
  const [data, setData] = useState(initial)
  const mutation = useWrite()
  const { runtime } = useDemoRuntime()
  if (runtime)
    return (
      <p className="metadata">
        Provider configuration is disabled in the demo. Add dated manual
        observations through the security editor.
      </p>
    )
  return (
    <form
      className="investment-editor"
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate({
          path: `/market-data/assets/${id}`,
          method: 'PUT',
          data,
        })
      }}
    >
      <Field label="Pricing mode">
        <select
          value={data.mode}
          onChange={(e) =>
            setData({ ...data, mode: e.target.value as 'MANUAL' | 'AUTOMATIC' })
          }
        >
          <option value="AUTOMATIC">Automatic with manual fallback</option>
          <option value="MANUAL">Manual observations only</option>
        </select>
      </Field>
      <Field label="Price provider">
        <select
          value={data.provider ?? ''}
          onChange={(e) =>
            setData({ ...data, provider: e.target.value || null })
          }
        >
          <option value="">Resolve from exchange</option>
          <option value="BRAPI">Brapi</option>
          <option value="ALPHA">Alpha Vantage</option>
          <option value="SYNTHETIC">Synthetic demo</option>
        </select>
      </Field>
      <Field label="Provider symbol override">
        <input
          value={data.symbol_override ?? ''}
          onChange={(e) =>
            setData({
              ...data,
              symbol_override: e.target.value.toUpperCase() || null,
            })
          }
          maxLength={40}
          placeholder="Use exchange mapping"
        />
      </Field>
      <Field label="Corporate-action gap from">
        <input
          type="date"
          value={data.blocked_from ?? ''}
          onChange={(e) =>
            setData({ ...data, blocked_from: e.target.value || null })
          }
        />
      </Field>
      <Field label="Corporate-action gap through">
        <input
          type="date"
          value={data.blocked_to ?? ''}
          onChange={(e) =>
            setData({ ...data, blocked_to: e.target.value || null })
          }
        />
      </Field>
      <Button disabled={mutation.isPending}>Save pricing</Button>
      {mutation.error && <ErrorState text={mutation.error.message} />}
      {mutation.isSuccess && <p role="status">Pricing preferences saved.</p>}
    </form>
  )
}

export function SecurityMarketData({
  id,
  asOf = '',
}: {
  id: string
  asOf?: string
}) {
  const [offset, setOffset] = useState(0)
  const query = useQuery({
    queryKey: ['market-data', 'security', id, offset, asOf],
    queryFn: () => getAssetMarket(id, offset, asOf),
  })
  if (query.isPending)
    return <LoadingState text="Loading cached price history…" />
  if (query.isError)
    return (
      <ErrorState
        text={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  const data = query.data
  return (
    <section>
      <SectionHeader
        title="Pricing and history"
        detail="Adjusted series are excluded from valuation. Manual entries switch this security to manual mode; automatic mode can be restored here."
      />
      <p className="metadata">
        {data.mapping
          ? `${data.mapping.provider} · ${data.mapping.symbol} · ${data.mapping.currency}`
          : data.mapping_error}{' '}
        · {data.sync?.error ?? 'Cached data'}{' '}
        {data.sync?.succeeded_at
          ? `· Updated ${data.sync.succeeded_at.slice(0, 16)}`
          : ''}
      </p>
      {data.current && (
        <div className="investment-primary">
          <strong>
            <Money
              value={data.current.price}
              currency={data.current.currency}
            />
          </strong>
          <small>
            {data.current.source} · Quote dated {data.current.price_date}
            {data.current.fetched_at
              ? ` · Retrieved ${data.current.fetched_at.slice(0, 16)}`
              : ' · Manual observation'}
          </small>
        </div>
      )}
      <SecurityHistory id={id} asOf={asOf} />
      <RefreshMarket assetId={id} backfill />
      <details>
        <summary>Pricing preferences and coverage</summary>
        <PricingForm
          key={JSON.stringify(data.pricing)}
          id={id}
          initial={data.pricing}
        />
        <p className="metadata">
          Corporate actions are not automated. Mark an affected date range
          unavailable until the activity history is corrected. An empty ending
          date leaves the gap open.
        </p>
      </details>
      <details>
        <summary>Cached price observations</summary>
        {!data.observations.length ? (
          <EmptyState
            title="No cached prices"
            detail="Add a manual observation or refresh a supported provider."
          />
        ) : (
          <div className="table-scroll">
            <table className="investment-table">
              <caption className="sr-only">Cached security prices</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="number">Price</th>
                  <th>Source</th>
                  <th>Convention</th>
                  <th>Retrieved</th>
                </tr>
              </thead>
              <tbody>
                {data.observations.map((p) => (
                  <tr key={p.id}>
                    <td>{p.price_date}</td>
                    <td className="number">
                      <Money value={p.price} currency={p.currency} />
                    </td>
                    <td>{p.source}</td>
                    <td>
                      {p.price_type === 'ADJUSTED'
                        ? 'Adjusted / not eligible'
                        : p.price_type}
                    </td>
                    <td>{p.fetched_at?.slice(0, 16) ?? 'Manual entry'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="investment-actions">
          <Button
            variant="ghost"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 200))}
          >
            Previous prices
          </Button>
          <Button
            variant="ghost"
            disabled={data.observations.length < 200}
            onClick={() => setOffset(offset + 200)}
          >
            Next prices
          </Button>
        </div>
      </details>
    </section>
  )
}

function SecurityHistory({ id, asOf }: { id: string; asOf: string }) {
  const today = new Date()
  const end =
    asOf ||
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const query = useQuery({
    queryKey: ['market-data', 'security-history', id, end],
    queryFn: ({ signal }) => getSecurityHistory(id, end, signal),
  })
  if (query.isPending) return <LoadingState text="Loading security chart…" />
  if (query.isError)
    return (
      <ErrorState
        text={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  if (!query.data.points.some((p) => p.value !== null))
    return (
      <EmptyState
        title="No eligible historical prices"
        detail="Add dated manual observations or backfill raw history. Adjusted prices cannot value these holdings."
      />
    )
  return (
    <Suspense fallback={<LoadingState text="Loading chart…" />}>
      <ValueChart history={query.data} security />
    </Suspense>
  )
}

export function PortfolioHistory({
  accountId,
  asOf,
}: {
  accountId: string
  asOf: string
}) {
  const [range, setRange] = useState('3M')
  const [currency, setCurrency] = useState('')
  const today = new Date()
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const end = asOf || localDate
  const start = new Date(`${end}T12:00:00Z`)
  start.setUTCMonth(
    start.getUTCMonth() -
      ({ '1M': 1, '3M': 3, '6M': 6, '1Y': 12, ALL: 120 }[range] ?? 3),
  )
  const params = new URLSearchParams({
    end,
    ...(range === 'ALL' ? {} : { start: start.toISOString().slice(0, 10) }),
    ...(accountId ? { account_id: accountId } : {}),
    ...(currency ? { reporting_currency: currency } : {}),
  })
  const query = useQuery({
    queryKey: ['market-data', 'history', params.toString()],
    queryFn: ({ signal }) => getMarketHistory(params, signal),
  })
  const valueParams = new URLSearchParams({
    as_of: end,
    ...(accountId ? { account_id: accountId } : {}),
    ...(currency ? { reporting_currency: currency } : {}),
  })
  const valuation = useQuery({
    queryKey: ['market-data', 'valuation', valueParams.toString()],
    queryFn: ({ signal }) => getReportingValue(valueParams, signal),
  })
  const report = valuation.data?.reporting
  return (
    <section>
      <SectionHeader
        title="Portfolio value"
        detail="Historical cash and quantities · Not a return or performance measure"
      />
      {report && (
        <div className="investment-primary">
          <span className="metadata">
            Reporting currency · {report.currency}
          </span>
          <strong>
            {report.total_value === null ? (
              'Incomplete valuation'
            ) : (
              <Money value={report.total_value} currency={report.currency} />
            )}
          </strong>
          {report.total_value === null && (
            <small>
              Known subtotal:{' '}
              <Money value={report.known_value} currency={report.currency} /> ·{' '}
              {report.missing_prices} missing prices ·{' '}
              {report.missing_fx.length} missing FX rates
            </small>
          )}
        </div>
      )}
      <div className="investment-toolbar">
        <nav className="range-tabs" aria-label="Portfolio history range">
          {['1M', '3M', '6M', '1Y', 'ALL'].map((r) => (
            <button
              key={r}
              aria-pressed={r === range}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </nav>
        <Field label="Valuation currency">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="">Configured currency</option>
            {['BRL', 'USD', 'EUR', 'JPY'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      {valuation.isError && <ErrorState text={valuation.error.message} />}
      {query.isPending ? (
        <LoadingState text="Reconstructing historical portfolio values…" />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <Suspense fallback={<LoadingState text="Loading chart…" />}>
            <ValueChart history={query.data} />
          </Suspense>
          <p className="metadata">{query.data.warning}</p>
          {query.data.points.some((p) => p.value === null) && (
            <p role="status" className="metadata">
              History is incomplete where prices or FX are unavailable. No
              values are interpolated across gaps.
            </p>
          )}
        </>
      )}
      <RefreshMarket />
    </section>
  )
}
