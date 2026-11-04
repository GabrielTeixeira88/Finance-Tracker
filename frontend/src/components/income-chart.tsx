import { useChartMotion } from '@/lib/motion'
import { t as tr } from '@/lib/i18n'
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { decimalUnits, unitsToMoney, formatMoney } from '@/lib/money'
import { Money, SectionHeader } from './primitives'

export default function IncomeChart({
  rows,
  currency,
}: {
  rows: { month: string; net: string }[]
  currency: string
}) {
  const chartMotion = useChartMotion()
  const maximum = rows.reduce((m, row) => {
    const v = decimalUnits(row.net)
    const magnitude = v < 0n ? -v : v
    return magnitude > m ? magnitude : m
  }, 0n)
  const history = rows.reduce<
    ((typeof rows)[number] & { cumulative: string })[]
  >(
    (result, row) => [
      ...result,
      {
        ...row,
        cumulative: unitsToMoney(
          decimalUnits(result.at(-1)?.cumulative ?? '0') +
            decimalUnits(row.net),
        ),
      },
    ],
    [],
  )
  const cumulativeMax = history.reduce((max, row) => {
    const v = decimalUnits(row.cumulative)
    const a = v < 0n ? -v : v
    return a > max ? a : max
  }, 0n)
  const data = history.map((row) => ({
    ...row,
    cumulativeCoordinate: cumulativeMax
      ? Number((decimalUnits(row.cumulative) * 10000n) / cumulativeMax) / 100
      : 0,
    coordinate: maximum
      ? Number((decimalUnits(row.net) * 10000n) / maximum) / 100
      : 0,
  }))
  return (
    <figure
      aria-label={tr('messages:message_96db5b8236eb', { value0: currency })}
      className="balance-chart"
    >
      <SectionHeader title={tr('parity:income_history')} detail={currency} />
      <ResponsiveContainer
        width="100%"
        height={510}
        initialDimension={{ width: 800, height: 300 }}
      >
        <ComposedChart
          data={data}
          margin={{ top: 30, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            minTickGap={30}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
          />
          <YAxis
            yAxisId="monthly"
            tickLine={false}
            axisLine={false}
            width={68}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickFormatter={(v) =>
              formatMoney(
                unitsToMoney((maximum * BigInt(Math.round(v * 100))) / 10000n),
                currency,
                { compact: true },
              )
            }
            domain={[data.some((r) => r.coordinate < 0) ? -110 : 0, 110]}
          />
          <YAxis
            yAxisId="cumulative"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={68}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickFormatter={(v) =>
              formatMoney(
                unitsToMoney(
                  (cumulativeMax * BigInt(Math.round(v * 100))) / 10000n,
                ),
                currency,
                { compact: true },
              )
            }
            domain={[
              data.some((r) => r.cumulativeCoordinate < 0) ? -110 : 0,
              110,
            ]}
          />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as
                (typeof data)[number] | undefined
              return active && p ? (
                <div className="chart-tooltip">
                  <p>{p.month}</p>
                  <Money value={p.net} currency={currency} />
                  <p>{tr('parity:cumulative_income')}</p>
                  <Money value={p.cumulative} currency={currency} />
                </div>
              ) : null
            }}
          />
          <Bar
            yAxisId="monthly"
            dataKey="coordinate"
            fill="var(--income-chart)"
            {...chartMotion}
            maxBarSize={24}
          />
          <Line
            yAxisId="cumulative"
            dataKey="cumulativeCoordinate"
            type="linear"
            dot={false}
            stroke="var(--chart-secondary)"
            strokeWidth={2}
            {...chartMotion}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <figcaption className="metadata">
        {' '}
        {tr('income_chart:recorded_net_investment_income__0e3024')} {currency}{' '}
        {tr('income_chart:_exact_monthly_amounts_below_760d9a')}{' '}
      </figcaption>
    </figure>
  )
}
