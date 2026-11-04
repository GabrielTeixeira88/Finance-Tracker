import { useChartMotion } from '@/lib/motion'
import { t as tr } from '@/lib/i18n'
import { getLocale } from '@/lib/preferences'
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
  const chartMotion = useChartMotion()
  const id = `overview-${useId().replaceAll(':', '')}`
  const data = chartCoordinates(dailyClosingPoints(points))
  return (
    <figure
      className="overview-chart"
      aria-label={tr('messages:message_230287b72eb8', { value0: currency })}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 1370, height: 280 }}
      >
        <AreaChart
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--net-worth-chart)"
                stopOpacity={0.2}
              />
              <stop
                offset="70%"
                stopColor="var(--net-worth-chart)"
                stopOpacity={0.12}
              />
              <stop
                offset="100%"
                stopColor="var(--net-worth-chart)"
                stopOpacity={0}
              />
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
            {...chartMotion}
            position={{ y: -20 }}
            cursor={{
              stroke: 'var(--chart-grid)',
              strokeWidth: 1,
            }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as
                (typeof data)[number] | undefined
              return active && point ? (
                <div className="overview-tooltip">
                  <p>
                    {new Intl.DateTimeFormat(getLocale(), {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }).format(new Date(point.time))}
                  </p>
                  <div>
                    <span className="chart-key" />{' '}
                    {tr('overview_chart:total_balance_891433')}{' '}
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
            stroke="var(--net-worth-chart)"
            strokeWidth={1}
            fill={`url(#${id})`}
            {...chartMotion}
            activeDot={{ r: 3, strokeWidth: 1 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        {' '}
        {tr(
          'overview_chart:closing_ledger_balances_use_view_exact_chart_dat_a574a5',
        )}{' '}
        {currency}.
      </figcaption>
    </figure>
  )
}
