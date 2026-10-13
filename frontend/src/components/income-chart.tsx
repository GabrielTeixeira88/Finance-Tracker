import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { decimalUnits } from '@/lib/money'
import { Money } from './primitives'

export default function IncomeChart({
  rows,
  currency,
}: {
  rows: { month: string; net: string }[]
  currency: string
}) {
  const maximum = rows.reduce((m, row) => {
    const v = decimalUnits(row.net)
    return v > m ? v : m
  }, 0n)
  const data = rows.map((row) => ({
    ...row,
    coordinate: maximum
      ? Number((decimalUnits(row.net) * 10000n) / maximum) / 100
      : 0,
  }))
  return (
    <figure
      aria-label={`${currency} monthly investment income`}
      className="balance-chart"
    >
      <ResponsiveContainer
        width="100%"
        height={250}
        initialDimension={{ width: 800, height: 250 }}
      >
        <BarChart data={data}>
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            minTickGap={30}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
          />
          <YAxis hide domain={[0, 110]} />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as
                (typeof data)[number] | undefined
              return active && p ? (
                <div className="chart-tooltip">
                  <p>{p.month}</p>
                  <Money value={p.net} currency={currency} />
                </div>
              ) : null
            }}
          />
          <Bar
            dataKey="coordinate"
            fill="var(--chart-line)"
            isAnimationActive={false}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
      <figcaption className="metadata">
        Recorded net investment income · {currency} · Exact monthly amounts
        below
      </figcaption>
    </figure>
  )
}
