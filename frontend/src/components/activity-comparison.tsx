import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { activityPercent } from '@/lib/money'
import { Money } from './primitives'

export function ActivityComparison({
  income,
  expenses,
  currency,
}: {
  income: string
  expenses: string
  currency: string
}) {
  const rows = [
    {
      name: 'Income',
      share: activityPercent(income, income, expenses),
      color: 'var(--positive)',
    },
    {
      name: 'Expenses',
      share: activityPercent(expenses, income, expenses),
      color: 'var(--negative)',
    },
  ]
  return (
    <div className="activity-comparison">
      <div className="activity-legend">
        <div>
          <span>
            <i className="legend-dot positive" />
            Income
          </span>
          <Money value={income} currency={currency} />
        </div>
        <div>
          <span>
            <i className="legend-dot negative" />
            Expenses
          </span>
          <Money value={expenses} currency={currency} />
        </div>
      </div>
      <div className="activity-chart" aria-hidden="true">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 400, height: 130 }}
        >
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
            accessibilityLayer={false}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" hide />
            <Bar
              dataKey="share"
              barSize={12}
              radius={[0, 3, 3, 0]}
              isAnimationActive={false}
              background={{ fill: 'var(--muted)', radius: 3 }}
            >
              {rows.map((row) => (
                <Cell key={row.name} fill={row.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="metadata">
        {currency} · Share of monthly income and expenses. Transfers and opening
        balances are excluded.
      </p>
    </div>
  )
}
