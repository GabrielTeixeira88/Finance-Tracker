import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/vendor/wealthfolio/ui/components/ui/carousel'
import { useMotionPolicy } from '@/lib/motion'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 performance-page.tsx: chart card, strip and
// selected-series controls. Local adapters retain exact values and API coverage.
import { useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Plus, X, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAccounts } from '@/lib/api'
import {
  analyticsParams,
  getPerformance,
  percent,
  type Performance,
} from '@/lib/investment-analytics'
import { getAssets } from '@/lib/investments'
import { decimalUnits, formatDate } from '@/lib/money'
import { useIsMobileViewport } from '@/features/holdings/compat'
import { DetailDrawer } from '@/components/detail-drawer'
import { Money, EmptyState, LoadingState } from '@/components/primitives'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/vendor/wealthfolio/ui/components/ui/card'
import { PerformanceChart } from './performance-chart'
import { PerformanceChartMobile } from './performance-chart-mobile'
import { PERFORMANCE_CHART_COLORS } from './performance-chart-colors'
import type { PerformanceSeries } from './series'
import '@/features/holdings/i18n'
import './performance.css'

type Metric = Performance['twr']
type Comparison = { id: string; name: string; kind: 'account' | 'benchmark' }
function StripMetric({
  label,
  metric,
  neutral = false,
}: {
  label: string
  metric?: Metric | null
  neutral?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <span className="text-muted-foreground truncate font-mono text-2xs font-medium tracking-[0.02em]">
        {label}
      </span>
      <strong
        className={`font-mono text-lg font-semibold leading-none tabular-nums ${!neutral && metric?.value ? (decimalUnits(metric.value) < 0n ? 'expense' : 'income') : ''}`}
      >
        {percent(metric?.value ?? null)}
      </strong>
      {!!metric?.reasons.length && (
        <span className="metadata" title={metric.reasons.join(', ')}>
          {metric.reasons
            .map((s) => s.toLowerCase().replaceAll('_', ' '))
            .join(' · ')}
        </span>
      )}
    </div>
  )
}

/** Each comparison is calculated at identical API boundaries, never rebased with JS floats. */
export function PerformanceWorkspace({
  data,
  accountId,
  benchmarkId,
  onSecurity,
}: {
  data: Performance
  accountId: string
  benchmarkId: string
  onSecurity: (id: string) => void
}) {
  const { t } = useTranslation(['wfPerformance', 'performanceMigration'])
  const mobile = useIsMobileViewport()
  const reduced = useMotionPolicy()
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [selected, setSelected] = useState('primary')
  const [picker, setPicker] = useState(false)
  const [showExact, setShowExact] = useState(false)
  const [attribution, setAttribution] = useState(false)
  const [retry, setRetry] = useState(0)
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: ({ signal }) => getAccounts(signal),
    enabled: picker,
  })
  const assets = useQuery({
    queryKey: ['investment-assets'],
    queryFn: () => getAssets(),
    enabled: picker,
  })
  const requests = useQueries({
    queries: comparisons.map((c) => ({
      queryKey: [
        'investment-comparison',
        c.kind,
        c.id,
        data.start,
        data.end,
        data.currency,
        retry,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getPerformance(
          analyticsParams(
            data.start,
            data.end,
            data.currency,
            c.kind === 'account' ? c.id : accountId,
            c.kind === 'benchmark' ? c.id : '',
          ),
          signal,
        ),
    })),
  })
  const series: PerformanceSeries[] = [
    {
      id: 'primary',
      name: t('performanceMigration:portfolio'),
      returns: data.points.map((p) => ({
        date: p.date,
        value: p.return_percent,
      })),
    },
  ]
  if (data.benchmark)
    series.push({
      id: 'benchmark',
      name: `${data.benchmark.symbol} · ${t('performanceMigration:priceProxy')}`,
      returns: data.benchmark.points.map((p) => ({
        date: p.date,
        value: p.return_percent,
      })),
      isReference: true,
    })
  comparisons.forEach((c, index) => {
    const response = requests[index].data
    const points =
      c.kind === 'benchmark' ? response?.benchmark?.points : response?.points
    series.push({
      id: c.id,
      name:
        c.name +
        (c.kind === 'benchmark'
          ? ` · ${t('performanceMigration:priceProxy')}`
          : ''),
      isReference: c.kind === 'benchmark',
      returns: (points ?? []).map((p) => ({
        date: p.date,
        value: p.return_percent,
      })),
    })
  })
  const comparisonIndex = comparisons.findIndex((c) => c.id === selected)
  const selectedResponse =
    comparisonIndex >= 0 ? requests[comparisonIndex]?.data : undefined
  const reference =
    selected === 'benchmark'
      ? data.benchmark
      : comparisonIndex >= 0 &&
          comparisons[comparisonIndex].kind === 'benchmark'
        ? selectedResponse?.benchmark
        : null
  const current =
    selected === 'primary' || selected === 'benchmark' ? data : selectedResponse
  const selectedName =
    series.find((s) => s.id === selected)?.name ?? series[0].name
  const displayed = reference?.return ?? current?.twr
  const hasHistory = series.some(
    (s) => s.returns.filter((p) => p.value !== null).length > 1,
  )
  return (
    <div className="performance-workspace">
      <div
        className="performance-comparisons"
        aria-label={t('performanceMigration:comparisons')}
      >
        {series.map((s, i) => (
          <div
            key={s.id}
            className={`performance-badge ${selected === s.id ? 'selected' : ''}`}
          >
            <button
              type="button"
              aria-pressed={selected === s.id}
              onClick={() => setSelected(s.id)}
            >
              <i style={{ background: PERFORMANCE_CHART_COLORS[i % 8] }} />
              {s.name}
            </button>
            {i > (data.benchmark ? 1 : 0) && (
              <button
                type="button"
                aria-label={t('performanceMigration:remove', { name: s.name })}
                onClick={() => {
                  setComparisons(comparisons.filter((c) => c.id !== s.id))
                  if (selected === s.id) setSelected('primary')
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        <button
          className="performance-add"
          type="button"
          onClick={() => setPicker(true)}
        >
          <Plus size={14} />
          {t('performanceMigration:addComparison')}
        </button>
      </div>
      <Card className="performance-source-card flex min-h-0 flex-1 flex-col">
        <CardHeader className={mobile ? 'px-3 py-3' : 'px-6 pb-2 pt-5'}>
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl">
                {t('wfPerformance:performance')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {formatDate(data.start)} – {formatDate(data.end)}
                <br />
                {selectedName}
              </CardDescription>
            </div>
            {mobile ? (
              <Carousel
                opts={{
                  align: 'start',
                  loop: false,
                  duration: reduced ? 0 : 25,
                }}
                className="performance-mobile-metrics w-full touch-pan-x overscroll-x-contain"
                tabIndex={0}
                aria-label={t('wfPerformance:section.returns')}
                data-no-swipe-drag
              >
                <CarouselContent className="-ms-2">
                  {[
                    [
                      reference
                        ? t('performanceMigration:priceProxy')
                        : t('performanceMigration:twr'),
                      displayed,
                      false,
                    ],
                    ...(!reference
                      ? [
                          [
                            t('performanceMigration:xirr'),
                            current?.xirr,
                            false,
                          ],
                          [
                            t('wfPerformance:metric.annualized_short'),
                            current?.annualized_twr,
                            false,
                          ],
                          [
                            t('wfPerformance:metric.volatility'),
                            current?.risk?.volatility,
                            true,
                          ],
                          [
                            t('wfPerformance:metric.max_drawdown_short'),
                            current?.risk?.max_drawdown,
                            false,
                          ],
                        ]
                      : []),
                  ].map(([label, metric, neutral]) => (
                    <CarouselItem
                      key={String(label)}
                      className="basis-[48%] ps-2"
                    >
                      <div className="bg-muted/30 rounded-lg px-3 py-2">
                        <StripMetric
                          label={String(label)}
                          metric={metric as Metric | undefined}
                          neutral={neutral === true}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                  {!reference && (
                    <CarouselItem className="basis-[52%] ps-2">
                      <button
                        type="button"
                        className="bg-muted/30 h-full w-full rounded-lg px-3 py-2 text-start"
                        onClick={() => setAttribution(true)}
                      >
                        <span className="metadata">
                          {t('wfPerformance:metric.gain_loss')}
                        </span>
                        <strong className="block font-mono text-base tabular-nums">
                          {current?.absolute_gain.value == null ? (
                            '—'
                          ) : (
                            <Money
                              value={current.absolute_gain.value}
                              currency={data.currency}
                            />
                          )}
                        </strong>
                      </button>
                    </CarouselItem>
                  )}
                </CarouselContent>
              </Carousel>
            ) : (
              <div className="performance-strip">
                <section className="performance-strip-section">
                  <div className="performance-strip-title">
                    {t('wfPerformance:section.returns')}
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                    <StripMetric
                      label={
                        reference
                          ? t('performanceMigration:priceProxy')
                          : t('performanceMigration:twr')
                      }
                      metric={displayed}
                    />
                    {!reference && (
                      <StripMetric
                        label={t('performanceMigration:xirr')}
                        metric={current?.xirr}
                      />
                    )}
                    {!reference && (
                      <StripMetric
                        label={t('wfPerformance:metric.annualized_short')}
                        metric={current?.annualized_twr}
                      />
                    )}
                  </div>
                </section>
                {!reference && (
                  <section className="performance-strip-section">
                    <div className="performance-strip-title">
                      {t('wfPerformance:section.risk')}
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <StripMetric
                        label={t('wfPerformance:metric.volatility')}
                        metric={current?.risk?.volatility}
                        neutral
                      />
                      <StripMetric
                        label={t('wfPerformance:metric.max_drawdown_short')}
                        metric={current?.risk?.max_drawdown}
                      />
                    </div>
                  </section>
                )}
                {!reference && (
                  <button
                    type="button"
                    className="performance-strip-section text-start"
                    onClick={() => setAttribution(true)}
                  >
                    <span className="performance-strip-title">
                      {t('wfPerformance:section.total')}
                    </span>
                    <span className="metadata">
                      {t('wfPerformance:metric.gain_loss')}{' '}
                      <Info className="inline" size={12} />
                    </span>
                    <strong className="font-mono text-lg tabular-nums">
                      {current?.absolute_gain.value == null ? (
                        '—'
                      ) : (
                        <Money
                          value={current.absolute_gain.value}
                          currency={data.currency}
                        />
                      )}
                    </strong>
                  </button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-2 sm:p-6">
          <figure
            aria-label={
              hasHistory ? t('performanceMigration:chart') : undefined
            }
            className="performance-chart-region"
          >
            {hasHistory ? (
              mobile ? (
                <PerformanceChartMobile data={series} />
              ) : (
                <PerformanceChart data={series} />
              )
            ) : (
              <EmptyState
                title={t('performanceMigration:noHistory')}
                detail={t('performanceMigration:noHistoryDetail')}
              />
            )}
            <figcaption className="sr-only">
              {t('performanceMigration:chartNote')}
            </figcaption>
          </figure>
        </CardContent>
      </Card>
      {requests.some((q) => q.isPending) && (
        <LoadingState text={t('performanceMigration:loadingComparisons')} />
      )}
      {requests.some((q) => q.isError) && (
        <p role="alert">
          {t('performanceMigration:comparisonError')}{' '}
          <button onClick={() => setRetry((v) => v + 1)}>
            {t('performanceMigration:retry')}
          </button>
        </p>
      )}
      <div className="performance-value-context">
        <span>
          {t('performanceMigration:endingValue')}{' '}
          <strong>
            {data.ending_value === null ? (
              '—'
            ) : (
              <Money value={data.ending_value} currency={data.currency} />
            )}
          </strong>
        </span>
        <span>
          {t('performanceMigration:funding')}{' '}
          <strong>
            {data.net_external_flows === null ? (
              '—'
            ) : (
              <Money value={data.net_external_flows} currency={data.currency} />
            )}
          </strong>
        </span>
      </div>
      <details
        className="chart-data"
        onToggle={(e) => setShowExact(e.currentTarget.open)}
      >
        <summary>{t('performanceMigration:exactData')}</summary>
        {showExact && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('performanceMigration:date')}</th>
                  {series.map((s) => (
                    <th key={s.id}>{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ...new Set(
                    series.flatMap((s) => s.returns.map((p) => p.date)),
                  ),
                ]
                  .sort()
                  .map((date) => (
                    <tr key={date}>
                      <th scope="row">{formatDate(date)}</th>
                      {series.map((s) => (
                        <td className="number" key={s.id}>
                          {percent(
                            s.returns.find((p) => p.date === date)?.value ??
                              null,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
      {picker && (
        <DetailDrawer
          title={t('performanceMigration:addComparison')}
          onClose={() => setPicker(false)}
        >
          <h3>{t('performanceMigration:accounts')}</h3>
          {accounts.isError && <p role="alert">{accounts.error.message}</p>}
          {accounts.data
            ?.filter(
              (a) =>
                a.type === 'INVESTMENT' &&
                a.id !== accountId &&
                !comparisons.some((c) => c.id === a.id),
            )
            .map((a) => (
              <button
                className="performance-picker-row"
                key={a.id}
                onClick={() => {
                  setComparisons([
                    ...comparisons,
                    { id: a.id, name: a.name, kind: 'account' },
                  ])
                  setPicker(false)
                }}
              >
                {a.name}
                <Plus size={14} />
              </button>
            ))}
          <h3>{t('performanceMigration:benchmarks')}</h3>
          <p className="metadata">{t('performanceMigration:benchmarkNote')}</p>
          {assets.isError && <p role="alert">{assets.error.message}</p>}
          {assets.data
            ?.filter(
              (a) =>
                a.id !== benchmarkId && !comparisons.some((c) => c.id === a.id),
            )
            .map((a) => (
              <button
                className="performance-picker-row"
                key={a.id}
                onClick={() => {
                  setComparisons([
                    ...comparisons,
                    { id: a.id, name: a.symbol, kind: 'benchmark' },
                  ])
                  setPicker(false)
                }}
              >
                {a.symbol} · {a.name}
                <Plus size={14} />
              </button>
            ))}
        </DetailDrawer>
      )}
      {attribution && current && (
        <DetailDrawer
          title={t('performanceMigration:attribution')}
          onClose={() => setAttribution(false)}
        >
          <p className="metadata">
            {selectedName} · {formatDate(data.start)} – {formatDate(data.end)}
          </p>
          <p>{t('performanceMigration:attributionNote')}</p>
          <dl className="performance-attribution">
            {[
              [t('performanceMigration:opening'), current.opening_value],
              [t('performanceMigration:funding'), current.net_external_flows],
              [
                t('wfPerformance:metric.gain_loss'),
                current.absolute_gain.value,
              ],
              [t('performanceMigration:endingValue'), current.ending_value],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {value === null ? (
                    '—'
                  ) : (
                    <Money value={value} currency={data.currency} />
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="metadata">{t('performanceMigration:riskNote')}</p>
          {data.benchmark && (
            <button onClick={() => onSecurity(benchmarkId)}>
              {t('performanceMigration:openBenchmark')}
            </button>
          )}
        </DetailDrawer>
      )}
    </div>
  )
}
