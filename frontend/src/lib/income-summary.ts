import type { Income } from './investment-analytics'
import { decimalUnits, sumMoney, unitsToMoney } from './money'

export function incomeSummary(
  data: Income,
  currency: string,
  start: string,
  end: string,
) {
  const entries = data.events.filter(
    (e) =>
      e.currency === currency && (!start || e.date >= start) && e.date <= end,
  )
  const first = start || entries.map((e) => e.date).sort()[0] || end
  const months: string[] = []
  const cursor = new Date(`${first.slice(0, 7)}-01T00:00:00Z`)
  while (
    cursor.toISOString().slice(0, 7) <= end.slice(0, 7) &&
    months.length < 121
  ) {
    months.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  const rows = months.map((month) => ({
    month,
    net: sumMoney(
      entries.filter((e) => e.date.startsWith(month)).map((e) => e.net),
    ),
  }))
  const total = sumMoney(rows.map((r) => r.net))
  const divisor = BigInt(Math.max(1, months.length))
  const units = decimalUnits(total)
  const average = unitsToMoney(
    (units + (units < 0n ? -divisor / 2n : divisor / 2n)) / divisor,
  )
  return { rows, total, average, months: months.length }
}
