// Adapted frontend source; provenance and license: THIRD_PARTY_NOTICES.md.
// SPDX-License-Identifier: AGPL-3.0-only
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
import { Money } from './primitives'
import { dailyClosingPoints } from '@/lib/closing-history'

export function OverviewChart({
  points,
  currency,
}: {
  points: { date: string; balance: string }[]
  currency: string
}) {
  const id = `overview-${useId().replaceAll(':', '')}`
  const data = chartCoordinates(dailyClosingPoints(points))
  return (
    <figure
      className="overview-chart"
      aria-label={`${currency} closing ledger balance history`}
    >
      <ResponsiveContainer
        width="100%"
        height={280}
        initialDimension={{ width: 1370, height: 280 }}
      >
        <AreaChart
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--positive)" stopOpacity={0.2} />
              <stop
                offset="70%"
                stopColor="var(--positive)"
                stopOpacity={0.12}
              />
              <stop offset="100%" stopColor="var(--positive)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            hide
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
          />
          <YAxis hide domain={[-15, 104]} />
          <Tooltip
            isAnimationActive={false}
            position={{ y: -20 }}
            cursor={{
              stroke: 'var(--border)',
              strokeWidth: 1,
            }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as
                (typeof data)[number] | undefined
              return active && point ? (
                <div className="overview-tooltip">
                  <p>
                    {new Intl.DateTimeFormat(navigator.language, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }).format(new Date(point.time))}
                  </p>
                  <div>
                    <span className="chart-key" />
                    Total balance
                    <Money value={point.balance} currency={currency} />
                  </div>
                </div>
              ) : null
            }}
          />
          <Area
            type="monotone"
            dataKey="coordinate"
            name="Closing balance"
            stroke="var(--positive)"
            strokeWidth={1}
            fill={`url(#${id})`}
            isAnimationActive={false}
            activeDot={{ r: 3, strokeWidth: 1 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        Closing ledger balances. Use View exact chart data for the accessible
        table. Currency: {currency}.
      </figcaption>
    </figure>
  )
}
