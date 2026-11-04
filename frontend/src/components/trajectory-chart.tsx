import { useChartMotion } from '@/lib/motion'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartCoordinates, formatDate } from '@/lib/money'
import { t } from '@/lib/i18n'
import { Money, SectionHeader } from './primitives'
import type { GoalDetail } from '@/lib/wealth-api'

export function TrajectoryChart({
  data,
  currency,
}: {
  data: NonNullable<GoalDetail['trajectory']>
  currency: string
}) {
  const chartMotion = useChartMotion()
  const keys = ['actual', 'required', 'projected'] as const
  const coordinates = new Map(
    chartCoordinates(
      data.points.flatMap((p, i) =>
        keys.flatMap((key) =>
          p[key] === null ? [] : [{ date: `${i}-${key}`, balance: p[key]! }],
        ),
      ),
    ).map((p) => [p.date, p.coordinate]),
  )
  const rows = data.points.map((p, i) => ({
    ...p,
    time: Date.parse(p.date + 'T12:00:00Z'),
    ...Object.fromEntries(
      keys.map((key) => [
        key + 'Coordinate',
        coordinates.get(`${i}-${key}`) ?? null,
      ]),
    ),
  }))
  return (
    <section className="trajectory-chart">
      <SectionHeader
        title={t('parity:trajectory')}
        detail={t('parity:projection_notice')}
      />
      <p role="status">{t(`parity:${data.status.toLowerCase()}`)}</p>
      <ResponsiveContainer
        width="100%"
        height={340}
        initialDimension={{ width: 800, height: 340 }}
      >
        <LineChart
          data={rows}
          margin={{ top: 20, right: 14, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            dataKey="time"
            domain={['dataMin', 'dataMax']}
            scale="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickFormatter={(n: number) =>
              formatDate(new Date(n).toISOString().slice(0, 10))
            }
            minTickGap={60}
          />
          <YAxis hide domain={[-5, 105]} />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as
                (typeof rows)[number] | undefined
              return active && p ? (
                <div className="chart-tooltip">
                  <p>{formatDate(p.date)}</p>
                  {keys.map(
                    (key) =>
                      p[key] !== null && (
                        <p key={key}>
                          {t(`parity:${key}`)}:{' '}
                          <Money
                            value={p[key]!}
                            currency={currency}
                            fractionDigits={2}
                          />
                        </p>
                      ),
                  )}
                </div>
              ) : null
            }}
          />
          <Line
            dataKey="actualCoordinate"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            {...chartMotion}
          />
          <Line
            dataKey="requiredCoordinate"
            stroke="var(--muted-foreground)"
            strokeDasharray="3 4"
            dot={false}
            connectNulls={false}
            {...chartMotion}
          />
          <Line
            dataKey="projectedCoordinate"
            stroke="var(--chart-secondary)"
            strokeDasharray="7 4"
            dot={false}
            connectNulls={false}
            {...chartMotion}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="metadata">
        {keys.map((key) => t(`parity:${key}`)).join(' · ')}
      </p>
      <details className="chart-data">
        <summary>{t('parity:exact_data')}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('parity:date')}</th>
                {keys.map((k) => (
                  <th key={k}>{t(`parity:${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.date}>
                  <td>{formatDate(p.date)}</td>
                  {keys.map((k) => (
                    <td key={k}>
                      {p[k] === null ? (
                        '—'
                      ) : (
                        <Money
                          value={p[k]!}
                          currency={currency}
                          fractionDigits={2}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
