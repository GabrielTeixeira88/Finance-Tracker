import { useChartMotion } from '@/lib/motion'
import { t as tr } from '@/lib/i18n'
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { decimalUnits } from '@/lib/money'
import { getLocale } from '@/lib/preferences'
import { Money, SectionHeader } from './primitives'

export function CashFlowChart({
  rows,
  currency,
}: {
  rows: { month: string; income: string; expenses: string }[]
  currency: string
}) {
  const chartMotion = useChartMotion()
  const max = rows
    .flatMap((r) => [decimalUnits(r.income), decimalUnits(r.expenses)])
    .reduce((a, b) => (a > (b < 0n ? -b : b) ? a : b < 0n ? -b : b), 0n)
  const data = rows.map((r) => ({
    ...r,
    in: max ? Number((decimalUnits(r.income) * 10000n) / max) / 100 : 0,
    out: max ? Number((decimalUnits(r.expenses) * 10000n) / max) / 100 : 0,
  }))
  return (
    <section className="composition-visual">
      <SectionHeader
        title={tr('cash_flow_chart:monthly_cash_flow_c4b18e')}
        detail={tr(
          'cash_flow_chart:income_and_net_expenses_transfers_and_openings_e_6470e3',
        )}
      />
      <ResponsiveContainer
        width="100%"
        height={260}
        initialDimension={{ width: 500, height: 260 }}
      >
        <BarChart
          data={data}
          margin={{ top: 10, bottom: 0, left: 0, right: 0 }}
        >
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            minTickGap={25}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickFormatter={(month) =>
              new Intl.DateTimeFormat(getLocale(), {
                month: 'short',
                year: '2-digit',
                timeZone: 'UTC',
              }).format(new Date(`${month}-01T12:00:00Z`))
            }
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: 'var(--chart-cursor)' }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as
                (typeof rows)[number] | undefined
              return active && row ? (
                <div className="chart-tooltip">
                  {row.month}
                  <p>
                    {' '}
                    {tr('cash_flow_chart:income_1c89b1')}{' '}
                    <Money value={row.income} currency={currency} />
                  </p>
                  <p>
                    {' '}
                    {tr('cash_flow_chart:expenses_8d437d')}{' '}
                    <Money value={row.expenses} currency={currency} />
                  </p>
                </div>
              ) : null
            }}
          />
          <Bar
            dataKey="in"
            fill="var(--positive)"
            radius={[3, 3, 0, 0]}
            {...chartMotion}
          />
          <Bar
            dataKey="out"
            fill="var(--negative)"
            radius={[3, 3, 0, 0]}
            {...chartMotion}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="metadata">{tr('cash_flow_chart:income_expenses_49cd46')}</p>
      <details className="chart-data">
        <summary>{tr('cash_flow_chart:view_exact_cash_flow_e196d3')}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr('cash_flow_chart:month_082bc3')}</th>
                <th>{tr('cash_flow_chart:income_1c89b1')}</th>
                <th>{tr('cash_flow_chart:expenses_8d437d')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>
                    <Money value={row.income} currency={currency} />
                  </td>
                  <td>
                    <Money value={row.expenses} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
