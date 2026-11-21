import { financialCurve } from '@/lib/chart-presentation'
import { useChartMotion } from '@/lib/motion'
import { formatDate } from '@/lib/money'
import { t as tr } from '@/lib/i18n'
import { getLocale } from '@/lib/preferences'
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
  const chartMotion = useChartMotion()
  const id = useId().replaceAll(':', '')
  const data = chartCoordinates(points)
  return (
    <figure
      className="balance-chart"
      aria-label={tr('messages:message_e0fb07b614d0', { value0: currency })}
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
                stopColor="var(--net-worth-chart)"
                stopOpacity={0.13}
              />
              <stop
                offset="100%"
                stopColor="var(--net-worth-chart)"
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
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickFormatter={(time: number) =>
              new Intl.DateTimeFormat(getLocale(), {
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
                  <p className="metadata">{formatDate(point.date)}</p>
                  <Money value={point.balance} currency={currency} />
                </div>
              ) : null
            }}
          />
          <Area
            type={financialCurve('ledger')}
            connectNulls={false}
            dataKey="coordinate"
            stroke="var(--net-worth-chart)"
            strokeWidth={1.8}
            fill={`url(#${id})`}
            {...chartMotion}
            name="Balance"
          />
        </AreaChart>
      </ResponsiveContainer>
      <figcaption className="metadata">
        {illustrative
          ? tr('dynamic:synthetic_illustration_not_ledger_history_43ebc9')
          : tr('dynamic:daily_closing_ledger_balance_1a2c2d')}{' '}
        · {currency} {tr('balance_chart:_hover_for_exact_values_c503c3')}{' '}
      </figcaption>
      <details className="chart-data">
        <summary>{tr('balance_chart:view_chart_data_6f09d2')}</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              {tr('balance_chart:exact_daily_balances_7fe7c3')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{tr('balance_chart:date_eb9a4b')}</th>
                <th scope="col" className="amount-cell">
                  {tr('balance_chart:balance_90eef6')}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={formatDate(point.date)}>
                  <td>{formatDate(point.date)}</td>
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
