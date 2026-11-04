import { useChartMotion } from '@/lib/motion'
import { t as tr } from '@/lib/i18n'
import { getLocale } from '@/lib/preferences'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartCoordinates, decimalUnits, unitsToMoney } from '@/lib/money'
import { percent, type Performance } from '@/lib/investment-analytics'

export default function PerformanceChart({ data }: { data: Performance }) {
  const chartMotion = useChartMotion()
  const combined = [
    ...data.points.map((p) => ({
      date: `p-${p.date}`,
      balance: p.return_percent,
    })),
    ...(data.benchmark?.points.map((p) => ({
      date: `b-${p.date}`,
      balance: p.return_percent,
    })) ?? []),
  ]
  const values = combined.flatMap((p) =>
    p.balance === null ? [] : [decimalUnits(p.balance)],
  )
  const minimum = values.reduce((a, b) => (a < b ? a : b), values[0] ?? 0n)
  const maximum = values.reduce((a, b) => (a > b ? a : b), values[0] ?? 0n)
  // Both series share one normalization domain. Separate domains would misrepresent comparisons.
  const coordinates = new Map(
    chartCoordinates(
      combined.flatMap((p) =>
        p.balance === null ? [] : [{ date: p.date, balance: p.balance }],
      ),
    ).map((p) => [p.date, p.coordinate]),
  )
  const benchmark = new Map(
    data.benchmark?.points.map((p) => [p.date, p.return_percent]),
  )
  const rows = data.points.map((p) => ({
    ...p,
    time: Date.parse(`${p.date}T12:00:00Z`),
    portfolio: coordinates.get(`p-${p.date}`) ?? null,
    benchmark: coordinates.get(`b-${p.date}`) ?? null,
    benchmarkReturn: benchmark.get(p.date) ?? null,
  }))
  return (
    <figure
      className="balance-chart performance-hero"
      aria-label={tr(
        'performance_chart:cash_flow_adjusted_investment_performance_e310cf',
      )}
    >
      <ResponsiveContainer
        width="100%"
        height={560}
        initialDimension={{ width: 900, height: 400 }}
      >
        <LineChart
          data={rows}
          margin={{ top: 20, left: 8, right: 8, bottom: 0 }}
        >
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            axisLine={false}
            tickLine={false}
            minTickGap={65}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickFormatter={(value) =>
              new Intl.DateTimeFormat(getLocale(), {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(value))
            }
          />
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            opacity={0.45}
          />
          <YAxis
            domain={[-8, 108]}
            width={68}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickFormatter={(v) =>
              percent(
                unitsToMoney(
                  minimum +
                    ((maximum - minimum) * BigInt(Math.round(v * 100))) /
                      10000n,
                ),
              )
            }
          />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as
                (typeof rows)[number] | undefined
              return active && p ? (
                <div className="chart-tooltip">
                  <p>{p.date}</p>
                  <p>
                    {' '}
                    {tr('performance_chart:portfolio__10d144')}{' '}
                    {percent(p.return_percent)}
                  </p>
                  {data.benchmark && (
                    <p>
                      {data.benchmark.symbol} · {percent(p.benchmarkReturn)}
                    </p>
                  )}
                </div>
              ) : null
            }}
          />
          <Line
            dataKey="portfolio"
            type="linear"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            {...chartMotion}
          />
          {data.benchmark && (
            <Line
              dataKey="benchmark"
              type="linear"
              stroke="var(--muted-foreground)"
              strokeDasharray="5 4"
              dot={false}
              connectNulls={false}
              {...chartMotion}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <figcaption className="metadata">
        {' '}
        {tr('performance_chart:portfolio_twr_3b58e3')}{' '}
        {data.benchmark
          ? tr('messages:message_2dc827014173', {
              value0: data.benchmark.symbol,
            })
          : ''}{' '}
        {tr('performance_chart:_gaps_mean_unavailable_coverage_5bb9f4')}{' '}
      </figcaption>
      <details className="chart-data">
        <summary>
          {tr('performance_chart:view_exact_performance_data_fd32aa')}
        </summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{tr('performance_chart:date_eb9a4b')}</th>
                <th scope="col">
                  {tr('performance_chart:portfolio_return_c21454')}
                </th>
                {data.benchmark && (
                  <th scope="col">
                    {tr('performance_chart:benchmark_return_7e9d73')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td>
                    {p.return_percent === null
                      ? tr('dynamic:unavailable_2c9c1f')
                      : `${p.return_percent}%`}
                  </td>
                  {data.benchmark && (
                    <td>
                      {p.benchmarkReturn === null
                        ? tr('dynamic:unavailable_2c9c1f')
                        : `${p.benchmarkReturn}%`}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
