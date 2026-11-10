import { t as tr, ui } from '@/lib/i18n'
import { PortfolioComposition } from '@/components/portfolio-composition'
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
        {tr(
          'market_data:synthetic_cached_history_external_refresh_disabl_3ecb23',
        )}
      </p>
    )
  return (
    <div className="investment-toolbar">
      {backfill && (
        <Field label={tr('market_data:backfill_from_33c216')}>
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
        {tr(
          'market_data:force_refresh_provider_limits_still_apply__79f7fd',
        )}{' '}
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
          ? tr('dynamic:refreshing__961411')
          : assetId
            ? tr('dynamic:refresh_security_3a8bc2')
            : tr('dynamic:refresh_market_data_51dafb')}
      </Button>
      {mutation.error && <ErrorState text={mutation.error.message} />}
      {mutation.isSuccess && (
        <p role="status" className="metadata">
          {' '}
          {tr(
            'market_data:refresh_finished_check_provider_status_and_cover_8c2dbd',
          )}{' '}
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
    return (
      <LoadingState
        text={tr('market_data:loading_market_data_settings__365fbb')}
      />
    )
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
        title={tr('market_data:market_data_3be934')}
        description={tr(
          'market_data:local_price_cache_optional_provider_synchronizat_a0af6c',
        )}
      />
      <div className="investment-toolbar">
        <Field label={tr('market_data:fx_source_68735c')}>
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
            <option value="ECB">
              {tr('market_data:ecb_reference_rates_e50234')}
            </option>
            <option value="SYNTHETIC">
              {tr('market_data:synthetic_demo_only_eb5355')}
            </option>
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
          {tr(
            'market_data:enable_automatic_refresh_while_the_api_is_runnin_3d17bf',
          )}{' '}
        </label>
      </div>
      <p className="metadata">
        {' '}
        {tr('market_data:automatic_refresh_checks_every_c28978')}{' '}
        {data.interval_minutes}{' '}
        {tr(
          'market_data:minutes_cached_views_work_offline_credentials_st_23184d',
        )}{' '}
      </p>
      <RefreshMarket />
      {mutation.error && <ErrorState text={mutation.error.message} />}
      <SectionHeader
        title={tr('market_data:providers_87b7c0')}
        detail={tr(
          'market_data:only_symbols_and_requested_dates_are_sent_to_pro_1c15da',
        )}
      />
      <div className="table-scroll">
        <table className="investment-table">
          <thead>
            <tr>
              <th>{tr('market_data:provider_7ceee3')}</th>
              <th>{tr('market_data:configuration_754164')}</th>
              <th>{tr('market_data:coverage_and_limits_9a6610')}</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>
                  {p.configured
                    ? tr('dynamic:available_configuration_11b611')
                    : tr('dynamic:api_key_not_configured_3260a8')}
                </td>
                <td>{p.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="metadata">
        {tr(
          'market_data:configure_brapi_api_token_and_alpha_vantage_api__2ca7b5',
        )}
      </p>
      <SectionHeader
        title={tr('market_data:synchronization_status_6957c9')}
        detail={tr(
          'market_data:provider_failures_never_delete_cached_observatio_46e79d',
        )}
      />
      {!data.sync.length ? (
        <EmptyState
          title={tr('market_data:no_synchronization_yet_81bf04')}
          detail={tr(
            'market_data:refresh_supported_securities_to_populate_the_loc_ed60d6',
          )}
        />
      ) : (
        <div className="table-scroll">
          <table className="investment-table">
            <thead>
              <tr>
                <th>{tr('market_data:scope_4651a3')}</th>
                <th>{tr('market_data:provider_7ceee3')}</th>
                <th>{tr('market_data:last_success_d9958c')}</th>
                <th>{tr('market_data:last_attempt_82aee1')}</th>
                <th>{tr('market_data:status_bae7d5')}</th>
                <th>{tr('market_data:coverage_80e135')}</th>
                <th>{tr('market_data:retry_after_75342d')}</th>
              </tr>
            </thead>
            <tbody>
              {data.sync.map((s) => (
                <tr key={s.scope}>
                  <td>
                    {s.scope === 'FX'
                      ? tr('dynamic:exchange_rates_f7600c')
                      : (s.symbol ?? s.scope.slice(0, 8))}
                  </td>
                  <td>{s.provider}</td>
                  <td>
                    {s.succeeded_at?.slice(0, 16) ?? tr('dynamic:never_80c305')}
                  </td>
                  <td>
                    {s.attempted_at?.slice(0, 16) ?? tr('dynamic:never_80c305')}
                  </td>
                  <td>{s.error ?? tr('dynamic:updated_f2f857')}</td>
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

export function PricingForm({
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
        {tr(
          'market_data:provider_configuration_is_disabled_in_the_demo_a_7e7acc',
        )}
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
      <Field label={tr('market_data:pricing_mode_1c466a')}>
        <select
          value={data.mode}
          onChange={(e) =>
            setData({ ...data, mode: e.target.value as 'MANUAL' | 'AUTOMATIC' })
          }
        >
          <option value="AUTOMATIC">
            {tr('market_data:automatic_with_manual_fallback_f719a5')}
          </option>
          <option value="MANUAL">
            {tr('market_data:manual_observations_only_8f72cb')}
          </option>
        </select>
      </Field>
      <Field label={tr('market_data:price_provider_be317e')}>
        <select
          value={data.provider ?? ''}
          onChange={(e) =>
            setData({ ...data, provider: e.target.value || null })
          }
        >
          <option value="">
            {tr('market_data:resolve_from_exchange_82b6be')}
          </option>
          <option value="BRAPI">{tr('market_data:brapi_55b4de')}</option>
          <option value="ALPHA">
            {tr('market_data:alpha_vantage_770315')}
          </option>
          <option value="SYNTHETIC">
            {tr('market_data:synthetic_demo_b890c0')}
          </option>
        </select>
      </Field>
      <Field label={tr('market_data:provider_symbol_override_ee9926')}>
        <input
          value={data.symbol_override ?? ''}
          onChange={(e) =>
            setData({
              ...data,
              symbol_override: e.target.value.toUpperCase() || null,
            })
          }
          maxLength={40}
          placeholder={tr('market_data:use_exchange_mapping_e70663')}
        />
      </Field>
      <Field label={tr('market_data:corporate_action_gap_from_ec74e6')}>
        <input
          type="date"
          value={data.blocked_from ?? ''}
          onChange={(e) =>
            setData({ ...data, blocked_from: e.target.value || null })
          }
        />
      </Field>
      <Field label={tr('market_data:corporate_action_gap_through_004b39')}>
        <input
          type="date"
          value={data.blocked_to ?? ''}
          onChange={(e) =>
            setData({ ...data, blocked_to: e.target.value || null })
          }
        />
      </Field>
      <Button disabled={mutation.isPending}>
        {tr('market_data:save_pricing_602725')}
      </Button>
      {mutation.error && <ErrorState text={mutation.error.message} />}
      {mutation.isSuccess && (
        <p role="status">
          {tr('market_data:pricing_preferences_saved__1943d9')}
        </p>
      )}
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
    return (
      <LoadingState
        text={tr('market_data:loading_cached_price_history__f06f9a')}
      />
    )
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
        title={tr('market_data:pricing_and_history_e492f3')}
        detail={tr(
          'market_data:adjusted_series_are_excluded_from_valuation_manu_f3a6bc',
        )}
      />
      <p className="metadata">
        {data.mapping
          ? `${data.mapping.provider} · ${data.mapping.symbol} · ${data.mapping.currency}`
          : data.mapping_error}{' '}
        · {data.sync?.error ?? tr('dynamic:cached_data_e8bbf7')}{' '}
        {data.sync?.succeeded_at
          ? tr('messages:message_515e7a5162d5', {
              value0: data.sync.succeeded_at.slice(0, 16),
            })
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
            {data.current.source} {tr('market_data:_quote_dated_1446c3')}{' '}
            {data.current.price_date}
            {data.current.fetched_at
              ? tr('messages:message_3ffb3153ed40', {
                  value0: data.current.fetched_at.slice(0, 16),
                })
              : tr('dynamic:_manual_observation_94063c')}
          </small>
        </div>
      )}
      <SecurityHistory id={id} asOf={asOf} />
      <RefreshMarket assetId={id} backfill />
      <details>
        <summary>
          {tr('market_data:pricing_preferences_and_coverage_87fd5e')}
        </summary>
        <PricingForm
          key={JSON.stringify(data.pricing)}
          id={id}
          initial={data.pricing}
        />
        <p className="metadata">
          {tr(
            'market_data:corporate_actions_are_not_automated_mark_an_affe_788d73',
          )}
        </p>
      </details>
      <details>
        <summary>{tr('market_data:cached_price_observations_9674c5')}</summary>
        {!data.observations.length ? (
          <EmptyState
            title={tr('market_data:no_cached_prices_8074fa')}
            detail={tr(
              'market_data:add_a_manual_observation_or_refresh_a_supported__cfcd16',
            )}
          />
        ) : (
          <div className="table-scroll">
            <table className="investment-table">
              <caption className="sr-only">
                {tr('market_data:cached_security_prices_c536ec')}
              </caption>
              <thead>
                <tr>
                  <th>{tr('market_data:date_eb9a4b')}</th>
                  <th className="number">{tr('market_data:price_3e8248')}</th>
                  <th>{tr('market_data:source_6da13a')}</th>
                  <th>{tr('market_data:convention_fa84f1')}</th>
                  <th>{tr('market_data:retrieved_5538ff')}</th>
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
                        ? tr('dynamic:adjusted_not_eligible_734a85')
                        : p.price_type}
                    </td>
                    <td>
                      {p.fetched_at?.slice(0, 16) ??
                        tr('dynamic:manual_entry_0ba9f7')}
                    </td>
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
            {tr('market_data:previous_prices_497281')}
          </Button>
          <Button
            variant="ghost"
            disabled={data.observations.length < 200}
            onClick={() => setOffset(offset + 200)}
          >
            {tr('market_data:next_prices_b281bb')}
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
  if (query.isPending)
    return (
      <LoadingState text={tr('market_data:loading_security_chart__5ba06b')} />
    )
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
        title={tr('market_data:no_eligible_historical_prices_234ab4')}
        detail={tr(
          'market_data:add_dated_manual_observations_or_backfill_raw_hi_f59623',
        )}
      />
    )
  return (
    <Suspense
      fallback={<LoadingState text={tr('market_data:loading_chart__b9eab5')} />}
    >
      <ValueChart history={query.data} security />
    </Suspense>
  )
}

export function PortfolioHistory({
  accountId,
  asOf,
  onSecurity,
}: {
  accountId: string
  asOf: string
  onSecurity?: (id: string) => void
}) {
  const [range, setRange] = useState('3M')
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
  })
  const query = useQuery({
    queryKey: ['market-data', 'history', params.toString()],
    queryFn: ({ signal }) => getMarketHistory(params, signal),
  })
  const valueParams = new URLSearchParams({
    as_of: end,
    ...(accountId ? { account_id: accountId } : {}),
  })
  const valuation = useQuery({
    queryKey: ['market-data', 'valuation', valueParams.toString()],
    queryFn: ({ signal }) => getReportingValue(valueParams, signal),
  })
  const report = valuation.data?.reporting
  return (
    <section className="portfolio-history">
      {report && (
        <div className="investment-primary">
          <span className="metadata">
            {' '}
            {tr('market_data:portfolio_value_73adb8')} · {report.currency}
          </span>
          <strong>
            {report.total_value === null ? (
              tr('dynamic:incomplete_valuation_6b0844')
            ) : (
              <Money value={report.total_value} currency={report.currency} />
            )}
          </strong>
          {report.total_value === null && (
            <small>
              {' '}
              {tr('market_data:known_subtotal__24b58c')}{' '}
              <Money value={report.known_value} currency={report.currency} /> ·{' '}
              {report.missing_prices} {tr('market_data:missing_prices__9dadce')}{' '}
              {report.missing_fx.length}{' '}
              {tr('market_data:missing_fx_rates_c83941')}{' '}
            </small>
          )}
        </div>
      )}
      <div className="investment-toolbar">
        <nav
          className="range-tabs"
          aria-label={tr('market_data:portfolio_history_range_c2d368')}
        >
          {['1M', '3M', '6M', '1Y', 'ALL'].map((r) => (
            <button
              key={ui(r)}
              aria-pressed={r === range}
              onClick={() => setRange(r)}
            >
              {ui(r)}
            </button>
          ))}
        </nav>
      </div>
      {valuation.isError && <ErrorState text={valuation.error.message} />}
      {query.isPending ? (
        <LoadingState
          text={tr(
            'market_data:reconstructing_historical_portfolio_values__100132',
          )}
        />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <Suspense
            fallback={
              <LoadingState text={tr('market_data:loading_chart__b9eab5')} />
            }
          >
            <ValueChart history={query.data} />
          </Suspense>
          <details className="chart-data">
            <summary>
              {tr(
                'market_data:historical_cash_and_quantities_not_a_return_or_p_ca7cca',
              )}
            </summary>
            <p className="metadata">{query.data.warning}</p>
          </details>
          {query.data.points.some((p) => p.value === null) && (
            <p role="status" className="metadata">
              {tr(
                'market_data:history_is_incomplete_where_prices_or_fx_are_una_cbb439',
              )}
            </p>
          )}
        </>
      )}
      <RefreshMarket />
      {report && onSecurity && (
        <details className="advanced-evidence">
          <summary>
            {tr('investment_analytics:portfolio_composition_e8ba11')}
          </summary>
          <PortfolioComposition
            accountId={accountId}
            asOf={end}
            currency={report.currency}
            onSecurity={onSecurity}
          />
        </details>
      )}
    </section>
  )
}
