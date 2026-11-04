// Geometry informed by the pinned budget-line-chart-card; see THIRD_PARTY_NOTICES.md.
// SPDX-License-Identifier: AGPL-3.0-only
import { useId } from 'react'
import type { BudgetReport } from '@/lib/budget-api'
import { budgetCurve } from '@/lib/budget-curve'
import { ui } from '@/lib/i18n'
import { formatMoney } from '@/lib/money'

export function BudgetPaceChart({ data }: { data: BudgetReport }) {
  const title = useId()
  const curve = budgetCurve(data)
  return (
    <div className="budget-curve">
      {curve.points.length ? (
        <svg viewBox="0 0 320 110" role="img" aria-labelledby={title}>
          <title id={title}>
            {ui('Cumulative spending')} · {data.month} ·{' '}
            {formatMoney(data.summary.expenses, data.currency)}
          </title>
          <line
            x1="0"
            x2="320"
            y1={curve.targetY}
            y2={curve.targetY}
            className="budget-target-line"
          />
          <path d={curve.path} className="budget-actual-line" />
          {curve.forecast && (
            <path d={curve.forecast} className="budget-forecast-line" />
          )}
          {curve.last && (
            <circle
              cx={curve.last.x}
              cy={curve.last.y}
              r="3"
              className="budget-endpoint"
            />
          )}
        </svg>
      ) : (
        <p className="metadata">{ui('No actual spending days yet')}</p>
      )}
      <div className="budget-curve-axis">
        <span>1</span>
        <span>{data.pace.days_in_month}</span>
      </div>
      <details>
        <summary>{ui('Chart details')}</summary>
        <p className="metadata">
          {ui('Cumulative spending')} · {ui('Available target')}:{' '}
          {formatMoney(data.summary.available, data.currency)}.{' '}
          {ui(
            'Forecast uses the existing elapsed-day pace; it is not historical spending.',
          )}
        </p>
        <table>
          <caption>{ui('Cumulative spending')}</caption>
          <thead>
            <tr>
              <th scope="col">{ui('Date')}</th>
              <th scope="col">{ui('Amount')}</th>
            </tr>
          </thead>
          <tbody>
            {curve.points.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td className="text-right">
                  {formatMoney(row.amount, data.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
