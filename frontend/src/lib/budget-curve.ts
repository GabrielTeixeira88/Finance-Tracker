import { decimalUnits, unitsToMoney } from './money'
import type { BudgetReport } from './budget-api'

/** Display projection only: the API remains authoritative for targets and pace. */
export function budgetCurve(data: BudgetReport) {
  let cumulative = 0n
  const points = data.daily
    .filter((row) => row.date <= data.as_of)
    .map((row) => {
      cumulative += decimalUnits(row.amount)
      return {
        date: row.date,
        day: Number(row.date.slice(8)),
        amount: unitsToMoney(cumulative),
      }
    })
  const available = decimalUnits(data.summary.available)
  const values = [
    0n,
    available,
    ...points.map((row) => decimalUnits(row.amount)),
  ]
  if (data.pace.projection !== null)
    values.push(decimalUnits(data.pace.projection))
  const low = values.reduce((a, b) => (a < b ? a : b), 0n)
  const high = values.reduce((a, b) => (a > b ? a : b), 0n)
  const span = high - low
  // Only dimensionless ratios cross into floating-point SVG geometry.
  const y = (amount: string) =>
    96 -
    (span
      ? Number(((decimalUnits(amount) - low) * 1_000_000n) / span) / 1_000_000
      : 0) *
      72
  const x = (day: number) =>
    ((day - 1) / Math.max(1, data.pace.days_in_month - 1)) * 320
  const path = points
    .map((row, index) => `${index ? 'L' : 'M'} ${x(row.day)} ${y(row.amount)}`)
    .join(' ')
  const last = points.at(-1)
  const forecast =
    data.pace.status === 'current' &&
    data.pace.projection !== null &&
    last &&
    last.day < data.pace.days_in_month
      ? `M ${x(last.day)} ${y(last.amount)} L 320 ${y(data.pace.projection)}`
      : null
  return {
    points,
    path,
    forecast,
    targetY: y(data.summary.available),
    last: last ? { x: x(last.day), y: y(last.amount) } : null,
  }
}
