import { useChartMotion } from '@/lib/motion'
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from 'recharts'
import type { FixedHistory } from '@/lib/fixed-income'
import { chartCoordinates, formatDate, formatExactPercent } from '@/lib/money'
import { t } from '@/lib/i18n'
import { Money, SectionHeader } from './primitives'

export function FixedIncomeChart({
  history,
  returns = false,
}: {
  history: FixedHistory
  returns?: boolean
}) {
  const chartMotion = useChartMotion()
  const first = history.points.map((p) =>
    returns ? p.contract_return_percent : p.value,
  )
  const second = history.points.map((p) =>
    returns ? p.cdi_return_percent : p.principal,
  )
  const all = [...first, ...second]
  const exact = all.flatMap((value, i) =>
    value === null
      ? []
      : [{ date: history.points[i % first.length].date, balance: value }],
  )
  const normalized = chartCoordinates(exact)
  let cursor = 0
  const coordinates = all.map((value) =>
    value === null ? null : normalized[cursor++].coordinate,
  )
  const rows = history.points.map((p, i) => ({
    ...p,
    first: coordinates[i],
    second: coordinates[i + first.length],
  }))
  const firstLabel = returns
    ? t('fixed_income:contract_return')
    : t('fixed_income:gross_value')
  const secondLabel = returns
    ? t('fixed_income:cdi_reference')
    : t('fixed_income:principal')
  return (
    <section
      className="fixed-income-chart"
      aria-label={
        returns
          ? t('fixed_income:return_comparison')
          : t('fixed_income:value_history')
      }
    >
      <SectionHeader
        title={
          returns
            ? t('fixed_income:return_comparison')
            : t('fixed_income:value_history')
        }
      />
      <p className="metadata">
        {firstLabel} · {secondLabel}
      </p>
      <ResponsiveContainer
        width="100%"
        height={260}
        initialDimension={{ width: 600, height: 260 }}
      >
        <LineChart
          data={rows}
          margin={{ top: 12, right: 10, left: 10, bottom: 8 }}
        >
          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDate(d)}
            minTickGap={60}
            tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
            axisLine={false}
            tickLine={false}
          />
          <Line
            dataKey="first"
            stroke="var(--investment-chart)"
            strokeWidth={2}
            dot={false}
            {...chartMotion}
            connectNulls={false}
          />
          <Line
            dataKey="second"
            stroke="var(--chart-secondary)"
            strokeDasharray="4 3"
            dot={false}
            {...chartMotion}
            connectNulls={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as
                (typeof rows)[number] | undefined
              if (!active || !row) return null
              const values = [
                returns ? row.contract_return_percent : row.value,
                returns ? row.cdi_return_percent : row.principal,
              ]
              return (
                <div className="chart-tooltip">
                  <strong>{formatDate(row.date)}</strong>
                  {values.map((value, index) => (
                    <p key={index}>
                      {index ? secondLabel : firstLabel}:{' '}
                      {value === null ? (
                        t('common:unavailable')
                      ) : returns ? (
                        formatExactPercent(value)
                      ) : (
                        <Money value={value} currency={history.currency} />
                      )}
                    </p>
                  ))}
                </div>
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
      <details>
        <summary>{t('fixed_income:exact_history')}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('fixed_income:date')}</th>
                <th>{firstLabel}</th>
                <th>{secondLabel}</th>
              </tr>
            </thead>
            <tbody>
              {history.points.map((p, i) => (
                <tr key={p.date}>
                  <td>{formatDate(p.date)}</td>
                  {[first[i], second[i]].map((value, k) => (
                    <td key={k} className="numeric">
                      {value === null ? (
                        t('common:unavailable')
                      ) : returns ? (
                        formatExactPercent(value)
                      ) : (
                        <Money value={value} currency={history.currency} />
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
