import { t as tr } from '@/lib/i18n'
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
            <i className="legend-dot positive" />{' '}
            {tr('activity_comparison:income_1c89b1')}{' '}
          </span>
          <Money value={income} currency={currency} />
        </div>
        <div>
          <span>
            <i className="legend-dot negative" />{' '}
            {tr('activity_comparison:expenses_8d437d')}{' '}
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
        {currency}{' '}
        {tr(
          'activity_comparison:_share_of_monthly_income_and_expenses_transfers__312a21',
        )}{' '}
      </p>
    </div>
  )
}
