// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 pages/net-worth/net-worth-content.tsx and
// components/{breakdown-table,composition-bar,category-detail-sheet,
// velocity-card,net-worth-attention}.tsx. Local exact API adapters replace upstream hooks.
import { useState } from 'react'
import {
  ChevronRight,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react'
import { t, ui } from '@/lib/i18n'
import {
  formatDecimal,
  decimalUnits,
  formatDate,
  formatRatioPercent,
} from '@/lib/money'
import {
  netWorthGroups,
  percentOf,
  magnitude,
  type NetWorthGroup,
  type NetWorthView,
} from '@/lib/net-worth-view'
import type { Position } from '@/lib/wealth-api'
import { DashboardCard } from './dashboard-card'
import { CategoryDetailSheet } from '@/features/dashboard/category-detail-sheet'
import { NetWorthChart } from './net-worth-chart'
import { MomentumCard } from '@/features/dashboard/momentum-card'
import { PeriodControls } from '@/features/dashboard/period-controls'
import '@/features/dashboard/dashboard.css'
import { EmptyState, Money } from './primitives'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { useWrite } from '@/lib/use-write'
import '../pages/net-worth-v014.css'

function Signed({
  value,
  currency,
  compact = false,
}: {
  value: string | null
  currency: string
  compact?: boolean
}) {
  if (value === null)
    return <span className="metadata">{t('common:unavailable')}</span>
  const units = decimalUnits(value)
  return (
    <Money
      value={value}
      currency={currency}
      compact={compact}
      minorUnits
      tone={units > 0n ? 'positive' : units < 0n ? 'negative' : 'neutral'}
      prefix={units > 0n ? '+' : ''}
    />
  )
}
function Ratio({ value }: { value: string | null }) {
  const { hidden } = useFinancialPrivacy()
  return (
    <span className="tabular-nums">
      {hidden ? '••••' : formatRatioPercent(value, 1)}
    </span>
  )
}
function groupLabel(group: NetWorthGroup) {
  if (group.kind !== 'LIABILITY') return t(`networth:${group.label}`)
  const labels: Record<string, string> = {
    MORTGAGE: 'mortgages',
    LOAN: 'loans',
    CREDIT_CARD: 'credit_cards',
    OTHER: 'other_liabilities',
  }
  return labels[group.label]
    ? t(`networth:${labels[group.label]}`)
    : group.label
}
function Composition({
  groups,
  total,
  complete,
}: {
  groups: NetWorthGroup[]
  total: string | null
  complete: boolean
}) {
  if (!complete || total === null || decimalUnits(total) <= 0n) return null
  return (
    <div
      className="net-worth-composition"
      aria-label={t('networth:composition')}
    >
      {groups
        .filter((g) => g.value !== null && decimalUnits(g.value) > 0n)
        .map((group) => (
          <span
            key={group.key}
            aria-label={groupLabel(group)}
            style={{
              flexGrow:
                Number(
                  (decimalUnits(group.value!) * 1000000n) / decimalUnits(total),
                ) / 10000,
              background: group.color,
            }}
          />
        ))}
    </div>
  )
}
// Source breakdown-table.tsx subgrid tracks: every section and total shares columns.
const SHARED_GRID =
  'col-span-full grid grid-cols-(--breakdown-columns) gap-x-3 supports-[grid-template-columns:subgrid]:grid-cols-subgrid @min-[40rem]/breakdown:gap-x-4'
const ROW_GRID = `${SHARED_GRID} items-baseline gap-y-1`
const NAME_CELL = 'col-span-full min-w-0 @min-[28rem]/breakdown:col-span-1'
const AMOUNT_CELL =
  'min-w-0 text-end text-xs tabular-nums [overflow-wrap:anywhere] @min-[40rem]/breakdown:text-sm'
function Breakdown({
  report,
  groups,
  onSelect,
}: {
  report: NetWorthView
  groups: NetWorthGroup[]
  onSelect: (g: NetWorthGroup) => void
}) {
  const [open, setOpen] = useState({ ASSET: true, LIABILITY: true })
  return (
    <div className="@container/breakdown">
      <DashboardCard
        title={t('networth:breakdown')}
        meta={t('networth:change_over_period')}
        className="net-worth-breakdown-card"
      >
        <div className="grid grid-cols-(--breakdown-columns) gap-x-3 [--breakdown-columns:var(--breakdown-fallback-columns)] [--breakdown-fallback-columns:repeat(2,minmax(0,1fr))] @min-[28rem]/breakdown:[--breakdown-fallback-columns:repeat(3,minmax(0,1fr))] supports-[grid-template-columns:subgrid]:@min-[28rem]/breakdown:[--breakdown-columns:minmax(0,1fr)_minmax(0,max-content)_minmax(0,max-content)] @min-[40rem]/breakdown:[--breakdown-fallback-columns:minmax(0,1fr)_repeat(3,minmax(0,max-content))] supports-[grid-template-columns:subgrid]:@min-[40rem]/breakdown:[--breakdown-columns:minmax(0,1fr)_minmax(0,max-content)_minmax(0,max-content)_minmax(0,max-content)]">
          {(['ASSET', 'LIABILITY'] as const).map((kind) => {
            const rows = groups.filter((g) => g.kind === kind),
              total = kind === 'ASSET' ? report.assets : report.liabilities
            if (
              kind === 'LIABILITY' &&
              !rows.length &&
              total !== null &&
              decimalUnits(total) === 0n
            )
              return null
            return (
              <section key={kind} className={SHARED_GRID}>
                {kind === 'LIABILITY' && (
                  <div className="col-span-full my-3 flex items-center gap-1.5">
                    <span className="text-muted-foreground w-3.5 text-center">
                      −
                    </span>
                    <div className="border-border/60 flex-1 border-t" />
                  </div>
                )}
                <button
                  className="col-span-full flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-start"
                  aria-expanded={open[kind]}
                  onClick={() => setOpen({ ...open, [kind]: !open[kind] })}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <ChevronRight
                      className={`text-muted-foreground h-3.5 w-3.5 transition-transform ${open[kind] ? 'rotate-90' : ''}`}
                    />
                    {t(
                      kind === 'ASSET'
                        ? 'networth:assets'
                        : 'networth:liabilities',
                    )}
                  </span>
                  <span
                    className={`min-w-0 text-sm font-semibold ${kind === 'ASSET' ? 'positive' : 'negative'}`}
                  >
                    {total === null ? (
                      t('common:unavailable')
                    ) : (
                      <>
                        <span>{kind === 'LIABILITY' ? '−' : ''}</span>
                        <Money value={total} currency={report.currency} />
                      </>
                    )}
                  </span>
                </button>
                {open[kind] && (
                  <div className={SHARED_GRID}>
                    {kind === 'ASSET' && (
                      <div className="col-span-full mt-2.5 mb-1 border-b pb-3">
                        <Composition
                          groups={rows}
                          total={total}
                          complete={report.complete}
                        />
                      </div>
                    )}
                    {kind === 'ASSET' && (
                      <div
                        className={`${ROW_GRID} pt-2 text-xs text-muted-foreground uppercase tracking-wide`}
                      >
                        <span className={NAME_CELL}>
                          {t('networth:category')}
                        </span>
                        <span className="hidden text-end @min-[40rem]/breakdown:block">
                          %
                        </span>
                        <span className="text-end">{t('networth:value')}</span>
                        <span className="text-end">{t('networth:change')}</span>
                      </div>
                    )}
                    <div className={`${SHARED_GRID} divide-border/40 divide-y`}>
                      {rows.map((group) => {
                        const first = group.history[0]?.value
                        const ratio =
                          group.change !== null && first != null
                            ? percentOf(group.change, first)
                            : null
                        return (
                          <div
                            key={group.key}
                            role="button"
                            tabIndex={0}
                            aria-label={groupLabel(group)}
                            onClick={() => onSelect(group)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onSelect(group)
                              }
                            }}
                            className={`${ROW_GRID} relative isolate cursor-pointer py-2 before:absolute before:-inset-x-2 before:inset-y-0 before:-z-10 before:rounded-md before:transition-colors hover:before:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring`}
                          >
                            <span
                              className={`${NAME_CELL} flex items-center gap-2 text-sm`}
                            >
                              <i
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: group.color }}
                              />
                              <span className="truncate">
                                {groupLabel(group)}
                              </span>
                            </span>
                            <span className="hidden text-end text-xs text-muted-foreground @min-[40rem]/breakdown:block">
                              <Ratio
                                value={
                                  group.value !== null && total !== null
                                    ? percentOf(group.value, total)
                                    : null
                                }
                              />
                            </span>
                            <span className={AMOUNT_CELL}>
                              {group.value === null ? (
                                t('common:unavailable')
                              ) : (
                                <>
                                  <span>{kind === 'LIABILITY' ? '−' : ''}</span>
                                  <Money
                                    value={group.value}
                                    currency={report.currency}
                                  />
                                </>
                              )}
                            </span>
                            <div className="flex min-w-0 flex-col items-end gap-x-2 gap-y-0.5 text-end @min-[48rem]/breakdown:flex-row @min-[48rem]/breakdown:flex-wrap @min-[48rem]/breakdown:items-baseline @min-[48rem]/breakdown:justify-end">
                              <span className={AMOUNT_CELL}>
                                <Signed
                                  value={group.change}
                                  currency={report.currency}
                                />
                              </span>
                              <span
                                className={`text-muted-foreground/60 ${AMOUNT_CELL}`}
                              >
                                {first != null &&
                                decimalUnits(first) === 0n &&
                                group.value !== null &&
                                decimalUnits(group.value) > 0n ? (
                                  t('networth:new')
                                ) : (
                                  <Ratio value={ratio} />
                                )}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {!rows.length && (
                      <p className="col-span-full metadata">
                        {t('networth:no_items')}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )
          })}
          <div className={`${ROW_GRID} border-border/60 mt-3 border-t pt-3`}>
            <span
              className={`${NAME_CELL} flex items-baseline gap-1.5 text-sm font-bold`}
            >
              <span className="text-muted-foreground w-3.5 text-center font-normal">
                =
              </span>
              {t('networth:net_worth')}
            </span>
            <span className="hidden @min-[40rem]/breakdown:block" />
            <span className={`${AMOUNT_CELL} font-bold`}>
              {report.value === null ? (
                t('common:unavailable')
              ) : (
                <Money value={report.value} currency={report.currency} />
              )}
            </span>
            <span className={AMOUNT_CELL}>
              <Signed value={report.change} currency={report.currency} />
            </span>
          </div>
        </div>
      </DashboardCard>
    </div>
  )
}
function Velocity({ report }: { report: NetWorthView }) {
  const { hidden } = useFinancialPrivacy()
  const velocity = report.insights?.velocity
  if (!velocity) return null
  const nonzero = velocity.drivers
    .filter((d) => decimalUnits(d.value) !== 0n)
    .sort((a, b) => {
      const x = decimalUnits(magnitude(a.value)),
        y = decimalUnits(magnitude(b.value))
      return x > y ? -1 : x < y ? 1 : a.key.localeCompare(b.key)
    })
  const max = nonzero.reduce((m, d) => {
    const n = decimalUnits(magnitude(d.value))
    return n > m ? n : m
  }, 1n)
  return (
    <DashboardCard
      title={t('networth:monthly_pace')}
      meta={t('networth:selected_period')}
    >
      <div className="net-worth-insight-value">
        <Signed value={velocity.per_month} currency={report.currency} compact />
        <small>{t('networth:per_month')}</small>
      </div>
      <p className="metadata">
        <Signed value={velocity.change} currency={report.currency} compact /> ·{' '}
        {formatDate(report.start)} – {formatDate(report.end)}
      </p>
      {velocity.pace_ratio != null && (
        <p className="metadata">
          {hidden ? '••••' : formatDecimal(velocity.pace_ratio)}×{' '}
          {t('networth:trailing_average')}
        </p>
      )}
      {!velocity.available ? (
        <p className="metadata">{t('networth:insufficient_history')}</p>
      ) : (
        <>
          <h3 className="net-worth-small-label">{t('networth:drivers')}</h3>
          <div className="net-worth-driver-list">
            {nonzero.map((driver) => (
              <div key={driver.key}>
                <div>
                  <span>{t(`networth:driver_${driver.key}`)}</span>
                  <Signed
                    value={driver.per_month}
                    currency={report.currency}
                    compact
                  />
                </div>
                <div className="net-worth-driver-track">
                  <i
                    style={{
                      width: `${Number((decimalUnits(magnitude(driver.value)) * 10000n) / max) / 100}%`,
                      background:
                        decimalUnits(driver.value) < 0n
                          ? 'var(--negative)'
                          : 'var(--positive)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <details className="net-worth-method-disclosure">
            <summary>{t('networth:method')}</summary>
            <p className="metadata">{t('networth:driver_method')}</p>
            <p className="metadata">{t('networth:not_performance')}</p>
          </details>
        </>
      )}
    </DashboardCard>
  )
}
function LinkMortgage({
  position,
  positions,
  asOf,
}: {
  position: Position
  positions: Position[]
  asOf: string
}) {
  const write = useWrite()
  const properties = positions.filter(
    (p) =>
      p.kind === 'ASSET' &&
      ['REAL_ESTATE', 'PROPERTY'].includes(p.category) &&
      p.start_date <= asOf &&
      (!p.end_date || p.end_date > asOf) &&
      p.currency === position.currency,
  )
  return (
    <div className="net-worth-link-mortgage">
      <label>
        {position.name}
        <select
          aria-label={t('networth:link_property')}
          defaultValue=""
          disabled={write.isPending}
          onChange={(e) => {
            if (!e.target.value) return
            const {
              name,
              kind,
              category,
              currency,
              liquidity,
              start_date,
              acquisition_cost,
              notes,
              terms,
              interest_rate,
              minimum_payment,
              payment_frequency,
              expected_payoff_date,
            } = position
            write.mutate({
              path: `/manual-positions/${position.id}`,
              method: 'PATCH',
              data: {
                name,
                kind,
                category,
                currency,
                liquidity,
                start_date,
                acquisition_cost,
                notes,
                terms,
                interest_rate,
                minimum_payment,
                payment_frequency,
                expected_payoff_date,
                associated_asset_id: e.target.value,
              },
            })
          }}
        >
          <option value="">{t('networth:link_property')}</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {write.isError && (
        <p role="alert" className="error">
          {write.error.message}
        </p>
      )}
      {!properties.length && (
        <p className="metadata">{t('networth:add_property_first')}</p>
      )}
    </div>
  )
}
function Attention({
  report,
  positions,
  onPosition,
}: {
  report: NetWorthView
  positions: Position[]
  onPosition: (id: string) => void
}) {
  const insights = report.insights
  if (
    !insights ||
    (!insights.stale.length && !insights.unlinked_mortgages.length)
  )
    return null
  return (
    <section
      className="net-worth-attention"
      aria-label={t('networth:attention')}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-warning/15">
          <AlertCircle className="size-4" />
        </span>
        <h2 className="text-foreground text-sm font-semibold">
          {t('networth:attention')}
        </h2>
      </div>
      {!!insights.stale.length && (
        <div className="ms-9 mt-3">
          <p>{t('networth:stale_help')}</p>
          {insights.stale.map((p) => (
            <button
              className="hover:bg-warning/10 -mx-2 mt-2 block w-full rounded-md px-2 py-1.5 text-start transition-colors"
              key={p.id}
              onClick={() => onPosition(p.id)}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 text-xs font-medium break-words">
                  {p.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {p.days} {t('networth:days_ago')}
                </span>
              </span>
              <small className="text-muted-foreground mt-1 block text-xs underline underline-offset-4">
                {t('dynamic:add_valuation_2cd0a4')}{' '}
                <ArrowUpRight className="inline" size={12} />
              </small>
            </button>
          ))}
        </div>
      )}
      {insights.unlinked_mortgages.map((id) => {
        const p = positions.find((p) => p.id === id)
        return p ? (
          <LinkMortgage
            key={id}
            position={p}
            positions={positions}
            asOf={report.end}
          />
        ) : null
      })}
    </section>
  )
}
export function NetWorthOverview({
  report,
  positions,
  period,
  setPeriod,
  onComponent,
  onPosition,
  chartSeries,
  seriesControl,
  methods,
  onDateRange,
  asOf,
}: {
  report: NetWorthView
  positions: Position[]
  period: string
  setPeriod: (s: string) => void
  onComponent: (c: NetWorthView['components'][number]) => void
  onPosition: (id: string) => void
  chartSeries: 'value' | 'assets' | 'liabilities'
  seriesControl: React.ReactNode
  methods: React.ReactNode
  onDateRange?: (period: { start: string; end: string; range: string }) => void
  asOf?: string
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const groups = netWorthGroups(report),
    group = groups.find((g) => g.key === selected)
  const privacy = useFinancialPrivacy()
  const empty =
    report.components.length === 0 &&
    decimalUnits(report.known_value) === 0n &&
    !report.insights?.tracked_since
  const label =
    chartSeries === 'value'
      ? t('networth:net_worth')
      : t(chartSeries === 'assets' ? 'networth:assets' : 'networth:liabilities')
  return (
    <div className="net-worth-source-overview">
      <header className="net-worth-source-balance">
        <div className="net-worth-primary-line">
          <h1>
            {report.value === null ? (
              t('common:unavailable')
            ) : (
              <Money
                value={report.value}
                currency={report.currency}
                fractionDigits={0}
              />
            )}
          </h1>
          <button
            className="net-worth-privacy"
            onClick={privacy.toggle}
            aria-pressed={privacy.hidden}
            aria-label={t(
              privacy.hidden
                ? 'networth:show_balances'
                : 'networth:hide_balances',
            )}
          >
            {privacy.hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="net-worth-source-change">
          <Signed value={report.change} currency={report.currency} />
          <span>
            <Ratio value={report.change_ratio} />
          </span>
          <small>{ui(period)}</small>
        </div>
        {!report.complete && (
          <p role="alert" className="net-worth-coverage">
            {t('networth:incomplete')}
          </p>
        )}
      </header>
      <div className="net-worth-landscape">
        {empty ? (
          <div className="net-worth-no-history">
            <p>{t('networth:no_history')}</p>
          </div>
        ) : (
          <NetWorthChart
            points={report.points.map((p) => ({ ...p, value: p[chartSeries] }))}
            currency={report.currency}
            label={label}
          />
        )}
        {onDateRange && asOf ? (
          <PeriodControls
            range={period}
            start={report.start}
            end={report.end}
            asOf={asOf}
            onChange={onDateRange}
          />
        ) : (
          <nav
            className="range-tabs net-worth-source-ranges"
            aria-label={t('networth:date_range')}
          >
            {['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL'].map(
              (range) => (
                <button
                  key={range}
                  aria-pressed={period === range}
                  onClick={() => setPeriod(range)}
                >
                  {range}
                </button>
              ),
            )}
          </nav>
        )}
        <div className={`net-worth-source-grid${empty ? ' is-empty' : ''}`}>
          <div>
            {!report.components.length &&
            decimalUnits(report.known_value) === 0n ? (
              <EmptyState
                title={t('networth:empty')}
                detail={t('networth:empty_help')}
              />
            ) : (
              <Breakdown
                report={report}
                groups={groups}
                onSelect={(g) => setSelected(g.key)}
              />
            )}
            <details className="net-worth-method-disclosure">
              <summary>{t('networth:details')}</summary>
              {seriesControl}
              {methods}
              <p className="metadata">{t('networth:not_performance')}</p>
              <p className="metadata">{report.method}</p>
              <table className="net-worth-native-values">
                <thead>
                  <tr>
                    <th>{t('networth:component')}</th>
                    <th>{t('networth:native')}</th>
                    <th>{report.currency}</th>
                    <th>{t('networth:coverage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.components.map((c) => (
                    <tr key={c.id}>
                      <th>
                        <button onClick={() => onComponent(c)}>{c.name}</button>
                      </th>
                      <td>
                        {c.native_value === null ? (
                          t('common:unavailable')
                        ) : (
                          <Money value={c.native_value} currency={c.currency} />
                        )}
                      </td>
                      <td>
                        {c.value === null ? (
                          t('common:unavailable')
                        ) : (
                          <Money value={c.value} currency={report.currency} />
                        )}
                      </td>
                      <td>
                        {c.missing.join('; ') ||
                          c.observation_date ||
                          t('networth:available')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
          {!empty && (
            <aside className="net-worth-insight-column">
              <Velocity report={report} />
              <MomentumCard report={report} period={period} />
              <Attention
                report={report}
                positions={positions}
                onPosition={onPosition}
              />
            </aside>
          )}
        </div>
      </div>
      {group && (
        <CategoryDetailSheet
          group={group}
          label={groupLabel(group)}
          report={report}
          onClose={() => setSelected(null)}
          onComponent={onComponent}
        />
      )}
    </div>
  )
}
