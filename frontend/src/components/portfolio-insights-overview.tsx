import '@/features/performance/performance.css'
import { useSyncExternalStore } from 'react'
import type { Holding } from '@/features/holdings/types'
import { useNumberFormatting } from '@/features/holdings/number-formatters'
import { navigateTo } from '@/lib/navigation'
import {
  getTreemapColor,
  getTreemapPaletteSnapshot,
  subscribeToTreemapTheme,
} from '@/features/performance/treemap-palette'
import { useQuery } from '@tanstack/react-query'
import { getHoldingsWorkspace } from '@/features/holdings/api'
import { TopMoversCard } from '@/features/performance/top-movers'
import { AllocationTargets } from '@/features/performance/allocation-targets'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 overview-page, value-strip, portfolio-explorer,
// drillable-donut-chart, composition-chart and holdings-highlight-cards.
// See THIRD_PARTY_NOTICES.md. Local API adapter preserves exact money/coverage.
import { useState, type ReactNode } from 'react'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
} from 'recharts'
import { t, ui } from '@/lib/i18n'
import {
  percent,
  type Allocation,
  type Insights,
} from '@/lib/investment-analytics'
import {
  classChildren,
  groupRows,
  insightDimensions,
  summaryValues,
  type AllocationGroup,
  type InsightDimension,
} from '@/lib/portfolio-insights'
import { compositionData, compositionColors } from '@/lib/composition'
import { decimalUnits, formatDecimal, sumMoney } from '@/lib/money'
import { useChartMotion } from '@/lib/motion'
import { DetailDrawer } from './detail-drawer'
import { Money, EmptyState } from './primitives'
import './portfolio-insights.css'
import { InsightsDashboard } from './insights-dashboard'
import type { WidgetId } from '@/lib/insights-layout'

const label = (key: string) => t(`portfolio_insights:${key}`)
function Value({
  value,
  currency,
}: {
  value: string | null | undefined
  currency: string
}) {
  return value == null ? (
    <span className="metadata">{t('common:unavailable')}</span>
  ) : (
    <Money value={value} currency={currency} />
  )
}
function groupLabel(dimension: string, name: string) {
  if (name === 'BOND') return t('fixed_income:title')
  if (name === 'Unknown') return label('unknown')
  if (
    dimension === 'instrument_type' &&
    ['CDB_CDI', 'CDB_FIXED', 'RDB_CDI', 'TESOURO_SELIC'].includes(name)
  )
    return label(name)
  return ['asset_class', 'instrument_type'].includes(dimension)
    ? ui(name)
    : name
}
function Widget({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`insight-widget ${className}`}>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

/** Upstream semi-donut interaction: hover centre, root->children, leaf->details. */
function AllocationDonut({
  data,
  dimension,
  onOpen,
}: {
  data: Allocation
  dimension: InsightDimension
  onOpen: (group: AllocationGroup, dimension: InsightDimension) => void
}) {
  const [parent, setParent] = useState<AllocationGroup | null>(null)
  const [active, setActive] = useState(0)
  const groups = parent
    ? classChildren(data, parent)
    : (data.groups[dimension] ?? [])
  const chart = compositionData(
    groups.map((group) => ({
      name: groupLabel(parent ? 'instrument_type' : dimension, group.name),
      value: group.value,
      weight: group.weight_percent,
    })),
    data.quality === 'COMPLETE',
  )
  const featured = chart?.[active] ?? chart?.[0]
  const open = (group: AllocationGroup) => {
    if (
      !parent &&
      dimension === 'asset_class' &&
      classChildren(data, group).length
    ) {
      setParent(group)
      setActive(0)
    } else onOpen(group, parent ? 'instrument_type' : dimension)
  }
  return (
    <Widget
      className="insight-donut"
      title={label(dimension)}
      action={
        parent && (
          <button
            className="insight-back"
            onClick={() => {
              setParent(null)
              setActive(0)
            }}
            aria-label={label('back')}
          >
            <ArrowLeft size={14} />
            {groupLabel(dimension, parent.name)}
          </button>
        )
      }
    >
      {chart === null ? (
        <EmptyState title={label('incomplete_chart')} />
      ) : chart.length === 0 ? (
        <EmptyState title={label('no_holdings')} />
      ) : (
        <div className="insight-arc">
          <ResponsiveContainer
            width="100%"
            height={160}
            initialDimension={{ width: 280, height: 160 }}
          >
            <PieChart>
              <Pie
                data={chart}
                dataKey="coordinate"
                nameKey="name"
                cy="80%"
                startAngle={180}
                endAngle={0}
                innerRadius="110%"
                outerRadius="140%"
                paddingAngle={4}
                cornerRadius={6}
                strokeWidth={1}
                stroke="var(--card)"
                isAnimationActive={false}
                onMouseEnter={(_, index) => setActive(index)}
                onClick={(_, index) => {
                  if (groups[index]) open(groups[index])
                }}
              >
                {chart.map((slice, i) => (
                  <Cell
                    key={slice.name}
                    fill={slice.color}
                    opacity={i === active ? 1 : 0.8}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {featured && (
            <button
              className="insight-arc-label"
              onClick={() => open(groups[active] ?? groups[0])}
            >
              <span>{featured.name}</span>
              <Value value={featured.exactValue} currency={data.currency} />
              <small>{percent(featured.weight ?? null)}</small>
            </button>
          )}
        </div>
      )}
      <details className="insight-exact">
        <summary>{label('exact_breakdown')}</summary>
        {groups.map((group, i) => (
          <button key={group.name} onClick={() => open(group)}>
            <i
              style={{
                background: compositionColors[i % compositionColors.length],
              }}
            />
            <span>
              {groupLabel(parent ? 'instrument_type' : dimension, group.name)}
            </span>
            <Value value={group.value} currency={data.currency} />
            <small>{percent(group.weight_percent)}</small>
          </button>
        ))}
      </details>
    </Widget>
  )
}

function Composition({
  data,
  onOpen,
  holdings,
}: {
  data: Allocation
  holdings: Holding[]
  onOpen: (group: AllocationGroup, dimension: InsightDimension) => void
}) {
  const [names, setNames] = useState(false)
  const [mode, setMode] = useState<'daily' | 'return'>('daily')
  const palette = useSyncExternalStore(
    subscribeToTreemapTheme,
    getTreemapPaletteSnapshot,
    getTreemapPaletteSnapshot,
  )
  const numbers = useNumberFormatting()
  const gain = (group: AllocationGroup) => {
    const ids = [
      ...new Set(group.members.map((m) => m.asset_id).filter(Boolean)),
    ]
    if (ids.length !== 1) return null
    const holding = holdings.find((h) => h.instrument?.id === ids[0])
    return holding
      ? mode === 'daily'
        ? holding.dayChangePct
        : holding.totalReturnPct
      : null
  }
  const motion = useChartMotion()
  const groups = data.groups.security ?? []
  const prepared = compositionData(
    groups.map((group) => ({
      name: group.name,
      value: group.value,
      weight: group.weight_percent,
    })),
    data.quality === 'COMPLETE',
  )
  const items =
    prepared?.map((item) => {
      const group = groups.find((g) => g.name === item.name)!
      const change = gain(group)
      const { fill, isLightTile } = getTreemapColor(change, mode, palette)
      const rgb =
        palette.isDark || !isLightTile ? palette.labelLight : palette.labelDark
      return {
        ...item,
        color: fill,
        change,
        labelColor: `rgb(${rgb.join(',')})`,
        fillOpacity: palette.isDark ? 0.45 : 1,
      }
    }) ?? null
  const node = (name: string) => {
    const group = groups.find((group) => group.name === name)
    const rows = group ? groupRows(data, group) : []
    return names
      ? (rows[0]?.name ?? name)
      : (rows[0]?.symbol ?? name.split(' · ')[0])
  }
  return (
    <Widget
      title={label('composition')}
      className="insight-composition"
      action={
        <div className="flex gap-2 items-center">
          <button
            className="insight-control"
            onClick={() => setNames(!names)}
            aria-pressed={names}
          >
            {label(names ? 'names' : 'symbols')}
          </button>
          <div
            role="group"
            aria-label={label('composition_mode')}
            className="insight-lenses"
          >
            {(['daily', 'return'] as const).map((value) => (
              <button
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label(value === 'daily' ? 'daily' : 'total_return')}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <p className="metadata">{label('composition_scope')}</p>
      {items === null ? (
        <EmptyState title={label('incomplete_chart')} />
      ) : items.length === 0 ? (
        <EmptyState title={label('no_holdings')} />
      ) : (
        <ResponsiveContainer
          width="100%"
          height={460}
          initialDimension={{ width: 900, height: 460 }}
        >
          <Treemap
            data={items}
            dataKey="coordinate"
            nameKey="name"
            {...motion}
            onClick={(entry) => {
              const group = groups.find((g) => g.name === entry.name)
              if (group) onOpen(group, 'security')
            }}
            content={
              <CompositionTile
                display={node}
                formatChange={(value) =>
                  value === null ? '—' : numbers.formatPercent(value)
                }
              />
            }
          >
            <Tooltip
              content={({ active, payload }) => {
                const item = payload?.[0]?.payload as
                  (typeof items)[number] | undefined
                if (!active || !item) return null
                const group = groups.find((g) => g.name === item.name)
                const sources = [
                  ...new Set(
                    group
                      ? groupRows(data, group)
                          .map((r) => r.price_source)
                          .filter(Boolean)
                      : [],
                  ),
                ]
                return (
                  <div className="chart-tooltip">
                    <strong>{node(item.name)}</strong>
                    <Value value={item.exactValue} currency={data.currency} />
                    <span>{percent(item.weight ?? null)}</span>
                    <span>
                      {label(mode === 'daily' ? 'daily' : 'total_return')}:{' '}
                      {item.change === null
                        ? '—'
                        : numbers.formatPercent(item.change)}
                    </span>
                    {sources.includes('SYNTHETIC') && (
                      <small>{label('simulated')}</small>
                    )}
                  </div>
                )
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      )}
      <details className="insight-exact">
        <summary>{label('exact_breakdown')}</summary>
        {groups.map((group) => (
          <button key={group.name} onClick={() => onOpen(group, 'security')}>
            <span>{node(group.name)}</span>
            <Value value={group.value} currency={data.currency} />
            <small>{percent(group.weight_percent)}</small>
          </button>
        ))}
      </details>
    </Widget>
  )
}
function CompositionTile({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  depth = 0,
  name = '',
  color = 'var(--chart-line)',
  display,
  change = null,
  labelColor = 'var(--foreground)',
  fillOpacity = 1,
  formatChange,
}: {
  x?: number
  y?: number
  width?: number
  height?: number
  depth?: number
  name?: string
  color?: string
  display: (name: string) => string
  change?: string | null
  labelColor?: string
  fillOpacity?: number
  formatChange: (value: string | null) => string
}) {
  if (depth !== 1) return <g />
  return (
    <g>
      <rect
        x={x + 3}
        y={y + 3}
        width={Math.max(0, width - 6)}
        height={Math.max(0, height - 6)}
        rx={10}
        fill={color}
        fillOpacity={fillOpacity}
        className="insight-treemap-tile"
      />
      {width > 70 && height > 34 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fontSize={14}
          fill={labelColor}
        >
          <tspan x={x + width / 2}>
            {display(name).slice(0, Math.max(4, Math.floor((width - 16) / 8)))}
          </tspan>
          {height > 55 && (
            <tspan x={x + width / 2} dy={16} fontSize={12}>
              {formatChange(change)}
            </tspan>
          )}
        </text>
      )}
    </g>
  )
}

function Holdings({
  data,
  group,
  onSecurity,
}: {
  data: Allocation
  group: AllocationGroup
  onSecurity: (id: string) => void
}) {
  const rows = groupRows(data, group)
  // Additive API compatibility: older responses may expose membership without enriched rows.
  if (!rows.length)
    return (
      <div className="insight-members">
        {group.members.map((member, i) =>
          member.asset_id ? (
            <button key={i} onClick={() => onSecurity(member.asset_id!)}>
              {t('investment_analytics:view_security_ab14a2')}
            </button>
          ) : (
            <small key={i}>{label('cash')}</small>
          ),
        )}
      </div>
    )
  return (
    <div className="insight-members">
      {rows.map((row) => (
        <div
          className="insight-holding"
          key={`${row.account_id}-${row.asset_id}`}
        >
          <div>
            {row.asset_id ? (
              <button
                className="investment-security"
                onClick={() => onSecurity(row.asset_id!)}
              >
                {row.symbol || row.security}
              </button>
            ) : (
              <strong>{label('cash')}</strong>
            )}
            <small>
              {row.name} ·{' '}
              <button
                className="insight-account-link"
                onClick={() => navigateTo('Account', row.account_id)}
              >
                {row.account}
              </button>
            </small>
            <small>
              {row.instrument_type &&
                groupLabel('instrument_type', row.instrument_type)}
              {row.issuer && row.issuer !== 'Unknown' ? ` · ${row.issuer}` : ''}
            </small>
            {row.price_source === 'SYNTHETIC' && (
              <small>{label('simulated')}</small>
            )}
            {row.contract_fictional && (
              <small>{label('fictional_contract')}</small>
            )}
          </div>
          <div className="number">
            <Value value={row.value} currency={data.currency} />
            <small>
              {row.asset_id && row.quantity !== undefined
                ? `${formatDecimal(row.quantity)} · `
                : ''}
              {row.currency}
            </small>
            <small>
              {row.price_source} {row.price_date}
            </small>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PortfolioInsightsOverview({
  data,
  insights,
  onSecurity,
  onCustomizeActionChange,
  asOf = new Date().toISOString().slice(0, 10),
  accountId = '',
}: {
  data: Allocation
  asOf?: string
  accountId?: string
  insights?: Insights
  onSecurity: (id: string) => void
  onCustomizeActionChange?: (action: ReactNode | null) => void
}) {
  const holdings = useQuery({
    queryKey: ['holdings-workspace', accountId, asOf],
    queryFn: ({ signal }) => getHoldingsWorkspace(accountId, asOf, signal),
  })
  const [dimension, setDimension] = useState<InsightDimension>('security')
  const [selection, setSelection] = useState<{
    group: AllocationGroup
    dimension: InsightDimension
  } | null>(null)
  const values = summaryValues(data)
  const groups = data.groups[dimension] ?? []
  const segments = compositionData(
    groups.map((g) => ({ name: g.name, value: g.value })),
    data.quality === 'COMPLETE',
  )
  const open = (group: AllocationGroup, dimension: InsightDimension) =>
    setSelection({ group, dimension })
  const metrics = [
    ['value', data.total_value],
    ['cash', values.cash_value],
    ['invested', values.invested_value],
    ['cost_basis', values.cost_basis],
    ['unrealized', values.unrealized],
  ] as const
  const widgets = {
    ...Object.fromEntries(
      metrics.map(([key, value]) => [
        key,
        <div className="insight-value-widget" key={key}>
          <span>{label(key)}</span>
          <strong
            className={
              key === 'unrealized' && value !== null
                ? decimalUnits(value) < 0n
                  ? 'expense'
                  : 'income'
                : ''
            }
          >
            <Value value={value} currency={data.currency} />
          </strong>
          {key === 'value' && (
            <small>
              {values.holdings_count} {label('holdings')}
            </small>
          )}
        </div>,
      ]),
    ),
    ...Object.fromEntries(
      (['account', 'asset_class', 'geography', 'sector'] as const).map(
        (key) => [
          key,
          <AllocationDonut
            key={`${key}-${data.currency}-${data.rows?.map((r) => `${r.account_id}:${r.asset_id}:${r.value}`).join('|')}`}
            data={data}
            dimension={key}
            onOpen={open}
          />,
        ],
      ),
    ),
    composition: (
      <Composition
        data={data}
        holdings={holdings.data?.rows ?? []}
        onOpen={open}
      />
    ),
    breakdown: (
      <Widget title={label('breakdown')} className="insight-explorer">
        <nav className="insight-lenses" aria-label={label('breakdown')}>
          {insightDimensions
            .filter((key) => data.groups[key])
            .map((key) => (
              <button
                key={key}
                aria-pressed={dimension === key}
                onClick={() => setDimension(key)}
              >
                {label(key)}
              </button>
            ))}
        </nav>
        {segments && segments.length > 0 && (
          <div
            className="insight-segments"
            aria-label={label('segmented')}
            role="group"
          >
            {segments
              .filter((s) => s.coordinate > 0)
              .map((segment, i) => (
                <button
                  key={segment.name}
                  style={{
                    flexGrow: segment.coordinate,
                    background: segment.color,
                  }}
                  title={`${groupLabel(dimension, segment.name)} · ${percent(groups[i]?.weight_percent ?? null)}`}
                  aria-label={groupLabel(dimension, segment.name)}
                  onClick={() =>
                    open(
                      groups.find((g) => g.name === segment.name)!,
                      dimension,
                    )
                  }
                />
              ))}
          </div>
        )}
        {!groups.length && <EmptyState title={label('no_holdings')} />}
        <div className="insight-breakdown-rows">
          {groups.map((group, index) => (
            <details key={`${dimension}-${group.name}`}>
              <summary>
                <ChevronRight size={14} className="insight-chevron" />
                <i
                  style={{
                    background:
                      compositionColors[index % compositionColors.length],
                  }}
                />
                <span>{groupLabel(dimension, group.name)}</span>
                <small className="number">
                  {percent(group.weight_percent)}
                </small>
                <Value value={group.value} currency={data.currency} />
              </summary>
              <Holdings data={data} group={group} onSecurity={onSecurity} />
              {dimension === 'asset_class' &&
                classChildren(data, group).map((child) => (
                  <button
                    className="insight-child"
                    key={child.name}
                    onClick={() => open(child, 'instrument_type')}
                  >
                    {groupLabel('instrument_type', child.name)}
                    <Value value={child.value} currency={data.currency} />
                  </button>
                ))}
              <button
                className="insight-detail-link"
                onClick={() => open(group, dimension)}
              >
                {label('details')}
                <ChevronRight size={14} />
              </button>
            </details>
          ))}
        </div>
        <p className="metadata">{label('metadata_policy')}</p>
      </Widget>
    ),
    top_movers: (
      <div>
        <TopMoversCard
          holdings={(holdings.data?.rows ?? []).filter(
            (h) => h.localCurrency === data.currency,
          )}
          currency={data.currency}
          isLoading={holdings.isPending}
          onSecurity={onSecurity}
        />
        <p className="metadata">{label('movers_policy')}</p>
        {holdings.isError && <p role="alert">{holdings.error.message}</p>}
      </div>
    ),
    targets: (
      <AllocationTargets
        data={data}
        asOf={asOf}
        accountId={accountId}
        onSecurity={onSecurity}
      />
    ),
    concentration: (
      <Widget title={label('concentration')}>
        <p className="metadata">{label('concentration_scope')}</p>
        <div className="insight-concentration">
          {['1', '3', '5'].map((n) => (
            <div key={n}>
              <small>
                {label('top')} {n}
              </small>
              <strong>{percent(data.concentration[n] ?? null)}</strong>
            </div>
          ))}
        </div>
        <div className="insight-leaders">
          {(data.groups.security ?? [])
            .filter((g) => g.members.some((m) => m.asset_id))
            .slice(0, 5)
            .map((group) => (
              <button key={group.name} onClick={() => open(group, 'security')}>
                <span>{groupRows(data, group)[0]?.symbol ?? group.name}</span>
                <span>{percent(group.weight_percent)}</span>
                <Value value={group.value} currency={data.currency} />
              </button>
            ))}
        </div>
      </Widget>
    ),
  } as Record<WidgetId, ReactNode>
  return (
    <div className="portfolio-insights-overview">
      <InsightsDashboard
        widgets={widgets}
        onCustomizeActionChange={onCustomizeActionChange}
      />
      <p className="insight-basis-note metadata">{label('basis_policy')}</p>
      {data.quality !== 'COMPLETE' && (
        <p role="status" className="insight-coverage">
          {t('investment_analytics:incomplete_valuation_known_subtotal_8b566e')}{' '}
          <Money value={data.known_value} currency={data.currency} /> ·{' '}
          {label('weights_unavailable')}
          <small>{data.reasons.join(' · ')}</small>
        </p>
      )}
      {insights && (
        <details className="native-basis-details">
          <summary>{t('parity:native_basis')}</summary>
          <div className="native-basis-strip">
            {[...new Set(insights.positions.map((p) => p.currency))].map(
              (currency) => {
                const rows = insights.positions.filter(
                  (p) => p.currency === currency,
                )
                return (
                  <div key={currency}>
                    <small>
                      {t('parity:native_basis')} · {currency}
                    </small>
                    <Money
                      value={sumMoney(rows.map((p) => p.cost_basis))}
                      currency={currency}
                    />
                    <small>{t('parity:native_unrealized')}</small>
                    <Value
                      value={
                        rows.some((p) => p.unrealized === null)
                          ? null
                          : sumMoney(rows.map((p) => p.unrealized!))
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
      {selection && (
        <DetailDrawer
          title={groupLabel(selection.dimension, selection.group.name)}
          onClose={() => setSelection(null)}
        >
          <div className="insight-detail-summary">
            <Value value={selection.group.value} currency={data.currency} />
            <span>
              {percent(selection.group.weight_percent)} ·{' '}
              {label('of_portfolio')}
            </span>
          </div>
          <Holdings
            data={data}
            group={selection.group}
            onSecurity={(id) => {
              setSelection(null)
              onSecurity(id)
            }}
          />
          <p className="metadata">{label('metadata_policy')}</p>
        </DetailDrawer>
      )}
    </div>
  )
}
