import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartCoordinates } from '@/lib/money'
import { percent, type Performance } from '@/lib/investment-analytics'

export default function PerformanceChart({ data }: { data: Performance }) {
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
      className="balance-chart"
      aria-label="Cash-flow-adjusted investment performance"
    >
      <ResponsiveContainer
        width="100%"
        height={320}
        initialDimension={{ width: 900, height: 320 }}
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
            tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
            tickFormatter={(value) =>
              new Intl.DateTimeFormat(navigator.language, {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(value))
            }
          />
          <YAxis hide domain={[-8, 108]} />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as
                (typeof rows)[number] | undefined
              return active && p ? (
                <div className="chart-tooltip">
                  <p>{p.date}</p>
                  <p>Portfolio · {percent(p.return_percent)}</p>
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
            isAnimationActive={false}
          />
          {data.benchmark && (
            <Line
              dataKey="benchmark"
              type="linear"
              stroke="var(--muted-foreground)"
              strokeDasharray="5 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <figcaption className="metadata">
        Portfolio TWR
        {data.benchmark
          ? ` · Dashed: ${data.benchmark.symbol} price-return proxy (not total return)`
          : ''}{' '}
        · Gaps mean unavailable coverage
      </figcaption>
      <details className="chart-data">
        <summary>View exact performance data</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Portfolio return</th>
                {data.benchmark && <th scope="col">Benchmark return</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td>
                    {p.return_percent === null
                      ? 'Unavailable'
                      : `${p.return_percent}%`}
                  </td>
                  {data.benchmark && (
                    <td>
                      {p.benchmarkReturn === null
                        ? 'Unavailable'
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
