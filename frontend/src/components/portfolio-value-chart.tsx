import { useId } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartCoordinates } from '@/lib/money'
import type { MarketHistory } from '@/lib/market-data'
import { Money } from './primitives'

export function PortfolioValueChart({
  history,
  security = false,
  label,
}: {
  history: MarketHistory
  security?: boolean
  label?: string
}) {
  const id = useId().replaceAll(':', '')
  const valid = history.points.flatMap((p) =>
    p.value === null ? [] : [{ date: p.date, balance: p.value }],
  )
  const coordinates = new Map(
    chartCoordinates(valid).map((p) => [p.date, p.coordinate]),
  )
  const data = history.points.map((p) => ({
    ...p,
    time: Date.parse(`${p.date}T12:00:00Z`),
    coordinate: coordinates.get(p.date) ?? null,
  }))
  return (
    <figure
      className="balance-chart"
      aria-label={`${history.currency} ${label ?? (security ? 'security price' : 'portfolio value')} history`}
    >
      <ResponsiveContainer
        width="100%"
        height={250}
        initialDimension={{ width: 800, height: 250 }}
      >
        <AreaChart
          data={data}
          margin={{ top: 14, right: 8, left: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--chart-line)"
                stopOpacity={0.13}
              />
              <stop
                offset="100%"
                stopColor="var(--chart-line)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            axisLine={false}
            tickLine={false}
            minTickGap={45}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
            tickFormatter={(time: number) =>
              new Intl.DateTimeFormat(navigator.language, {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(time))
            }
          />
          <YAxis hide domain={[-8, 108]} />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as
                (typeof data)[number] | undefined
              return active && p ? (
                <div className="chart-tooltip">
                  <p className="metadata">{p.date}</p>
                  {p.value === null ? (
                    'Incomplete valuation'
                  ) : (
                    <Money value={p.value} currency={history.currency} />
                  )}
                </div>
              ) : null
            }}
          />
          <Area
            type="stepAfter"
            dataKey="coordinate"
            connectNulls={false}
            stroke="var(--chart-line)"
            strokeWidth={1.8}
            fill={`url(#${id})`}
            isAnimationActive={false}
            name={label ?? 'Portfolio value'}
          />
        </AreaChart>
      </ResponsiveContainer>
      <figcaption className="metadata">
        {label ??
          (security ? 'Eligible security prices' : 'Cash plus securities')}{' '}
        · {history.currency} · Gaps mean missing coverage ·{' '}
        {label
          ? 'Dated records; no projected returns'
          : security
            ? 'Original quote currency'
            : history.fx_provider === 'SYNTHETIC'
              ? 'Synthetic demo FX'
              : 'Dated ECB FX'}
      </figcaption>
      <details className="chart-data">
        <summary>
          {label
            ? `View ${label.toLowerCase()} chart data`
            : security
              ? 'View security chart data'
              : 'View portfolio chart data'}
        </summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Exact historical {label ?? 'portfolio'} values
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="amount-cell">
                  Value
                </th>
                <th scope="col">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {history.points.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td className="amount-cell">
                    {p.value === null ? (
                      'Unavailable'
                    ) : (
                      <Money value={p.value} currency={history.currency} />
                    )}
                  </td>
                  <td>
                    {label
                      ? p.value === null
                        ? 'Unavailable'
                        : 'Available'
                      : p.missing_assets.length || p.missing_fx.length
                        ? `${p.missing_assets.length} unpriced assets; ${p.missing_fx.length} missing FX rates`
                        : 'Available'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
