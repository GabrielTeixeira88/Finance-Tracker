import { useChartMotion } from '@/lib/motion'
import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Treemap,
} from 'recharts'
import { Money, EmptyState, SectionHeader } from './primitives'
import { formatExactPercent } from '@/lib/money'

import {
  compositionData,
  compositionColors as colors,
  type CompositionItem,
} from '@/lib/composition'
export function CompositionChart({
  title,
  items,
  currency,
  complete = true,
  kind = 'arc',
  compact = false,
  onSelect,
}: {
  title: string
  items: CompositionItem[]
  currency: string
  complete?: boolean
  kind?: 'arc' | 'treemap'
  compact?: boolean
  onSelect?: (item: CompositionItem) => void
}) {
  const chartMotion = useChartMotion()
  const data = compositionData(items, complete)
  const [active, setActive] = useState(0)
  const featured = data?.[active] ?? data?.[0]
  return (
    <section className="composition-visual" aria-label={title}>
      <SectionHeader title={title} />
      {data === null ? (
        <EmptyState
          title={tr('composition_chart:composition_unavailable_9973d9')}
          detail={tr(
            'composition_chart:missing_or_negative_values_cannot_be_represented_6cc7d6',
          )}
        />
      ) : !data.length ? (
        <EmptyState
          title={tr('composition_chart:no_positive_balance_to_display_5639e5')}
        />
      ) : (
        <ResponsiveContainer
          width="100%"
          height={
            kind === 'treemap' ? (compact ? 280 : 500) : compact ? 144 : 195
          }
          initialDimension={{ width: 460, height: 195 }}
        >
          {kind === 'treemap' ? (
            <Treemap
              data={data}
              dataKey="coordinate"
              nameKey="name"
              {...chartMotion}
              content={<Tile />}
            >
              <Tooltip
                content={({ active, payload }) => {
                  const item = payload?.[0]?.payload as
                    (typeof data)[number] | undefined
                  return active && item ? (
                    <div className="chart-tooltip">
                      {item.name}
                      <Money value={item.exactValue} currency={currency} />
                      {item.weight !== undefined && item.weight !== null
                        ? formatExactPercent(item.weight)
                        : ''}
                    </div>
                  ) : null
                }}
              />
            </Treemap>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey="coordinate"
                nameKey="name"
                cx="50%"
                cy={compact ? '90%' : '85%'}
                startAngle={180}
                endAngle={0}
                innerRadius={compact ? 90 : '85%'}
                outerRadius={compact ? 110 : '110%'}
                stroke="var(--card)"
                strokeWidth={compact ? 5 : 2}
                onMouseEnter={(_, index) => setActive(index)}
                {...chartMotion}
              >
                {data.map((row, index) => (
                  <Cell key={index} fill={row.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const item = payload?.[0]?.payload as
                    (typeof data)[number] | undefined
                  return active && item ? (
                    <div className="chart-tooltip">
                      {item.name}
                      <Money value={item.exactValue} currency={currency} />
                    </div>
                  ) : null
                }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      )}
      {compact && featured && (
        <div className="composition-featured">
          <span>{featured.name}</span>
          <Money value={featured.exactValue} currency={currency} minorUnits />
          {featured.weight != null && (
            <small title={formatExactPercent(featured.weight)}>
              {formatExactPercent(featured.weight, 2)}
            </small>
          )}
        </div>
      )}
      <details
        className={
          compact || kind === 'treemap'
            ? 'composition-exact compact'
            : 'composition-exact'
        }
        open={!compact && kind !== 'treemap'}
      >
        <summary>{tr('parity:exact_breakdown')}</summary>
        <div className="composition-legend">
          {items.map((item, index) => {
            const content = (
              <>
                <i
                  className="legend-dot"
                  style={{ background: colors[index % colors.length] }}
                  aria-hidden="true"
                />
                <span>{item.name}</span>
                {item.value === null ? (
                  <span className="metadata">
                    {tr('composition_chart:unavailable_2c9c1f')}
                  </span>
                ) : (
                  <Money value={item.value} currency={currency} />
                )}
              </>
            )
            return onSelect ? (
              <button key={index} onClick={() => onSelect(item)}>
                {content}
              </button>
            ) : (
              <div className="legend-row" key={index}>
                {content}
              </div>
            )
          })}
        </div>
      </details>
    </section>
  )
}
function Tile({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  depth = 0,
  name = '',
  color = 'var(--chart-line)',
}: {
  x?: number
  y?: number
  width?: number
  height?: number
  depth?: number
  name?: string
  color?: string
}) {
  if (depth !== 1) return <g />
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.85}
        stroke="var(--card)"
        strokeWidth={3}
        rx={6}
      />
      {width > 70 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="var(--background)"
          fontSize={12}
        >
          {name.length > Math.floor(width / 8)
            ? `${name.slice(0, Math.floor(width / 8) - 1)}…`
            : name}
        </text>
      )}
    </g>
  )
}
