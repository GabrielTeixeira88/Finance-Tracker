import { useId } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartCoordinates, formatMoney } from '@/lib/money'
import { Money } from './primitives'

export function BalanceChart({
  points,
  currency,
  illustrative = false,
}: {
  points: { date: string; balance: string }[]
  currency: string
  illustrative?: boolean
}) {
  const id = useId().replaceAll(':', '')
  const data = chartCoordinates(points)
  return (
    <figure
      className="balance-chart"
      aria-label={`${currency} balance history`}
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
              const point = payload?.[0]?.payload as
                (typeof data)[number] | undefined
              return active && point ? (
                <div className="chart-tooltip">
                  <p className="metadata">{point.date}</p>
                  <Money value={point.balance} currency={currency} />
                </div>
              ) : null
            }}
          />
          <Area
            type="stepAfter"
            dataKey="coordinate"
            stroke="var(--chart-line)"
            strokeWidth={1.8}
            fill={`url(#${id})`}
            isAnimationActive={false}
            name="Balance"
          />
        </AreaChart>
      </ResponsiveContainer>
      <figcaption className="metadata">
        {illustrative
          ? 'Synthetic illustration, not ledger history'
          : 'Daily closing ledger balance'}{' '}
        · {currency} · Hover for exact values
      </figcaption>
      <details className="chart-data">
        <summary>View chart data</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Exact daily balances</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="amount-cell">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td className="amount-cell">
                    {formatMoney(point.balance, currency)}
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
