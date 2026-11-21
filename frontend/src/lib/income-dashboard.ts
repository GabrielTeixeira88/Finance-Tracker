// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 income-page / income-history-chart.
// Local inclusive dates, exact decimal strings and native-currency groups.
import type { Income } from './investment-analytics'
import { startDate } from './investment-analytics'
import { incomeSummary } from './income-summary'
import { decimalUnits, sumMoney, unitsToMoney } from './money'

export function previousYear(day: string) {
  const date = new Date(`${day}T12:00:00Z`)
  const month = date.getUTCMonth(),
    year = date.getUTCFullYear() - 1
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(last, date.getUTCDate())).padStart(2, '0')}`
}
export function incomePeriod(period: string, asOf: string, custom = '') {
  const year = asOf.slice(0, 4)
  const end = period === 'LAST_YEAR' ? `${parseInt(year) - 1}-12-31` : asOf
  const start =
    period === 'LAST_YEAR'
      ? `${parseInt(year) - 1}-01-01`
      : period === 'YTD'
        ? `${year}-01-01`
        : startDate(period, asOf, custom)
  return {
    start,
    end,
    previousStart: previousYear(start),
    previousEnd: previousYear(end),
  }
}
/** Null when no meaningful positive comparison base exists; never invent infinite growth. */
export function incomeChange(current: string, previous: string | null) {
  if (previous === null || decimalUnits(previous) <= 0n) return null
  return unitsToMoney(
    ((decimalUnits(current) - decimalUnits(previous)) * 100_000_000n) /
      decimalUnits(previous),
  )
}
export function receivedIncome(
  data: Income,
  currency: string,
  start: string,
  end: string,
  previous?: Income,
) {
  const summary = incomeSummary(data, currency, start, end)
  const events = data.events.filter(
    (e) => e.currency === currency && e.date >= start && e.date <= end,
  )
  const accountIds = [...new Set(events.map((e) => e.account_id))]
  const accounts = accountIds.map((id) => ({
    id,
    name: events.find((e) => e.account_id === id)!.account,
  }))
  const rows = summary.rows.map((row) => ({
    ...row,
    previous: previous
      ? sumMoney(
          previous.events
            .filter(
              (e) =>
                e.currency === currency &&
                e.date.slice(0, 7) ===
                  previousYear(`${row.month}-01`).slice(0, 7),
            )
            .map((e) => e.net),
        )
      : null,
    accounts: Object.fromEntries(
      accounts.map((account) => [
        account.id,
        sumMoney(
          events
            .filter(
              (e) =>
                e.account_id === account.id && e.date.startsWith(row.month),
            )
            .map((e) => e.net),
        ),
      ]),
    ),
  }))
  const types = ['DIVIDEND', 'INTEREST'].map((type) => ({
    name: type,
    value: sumMoney(events.filter((e) => e.type === type).map((e) => e.net)),
  }))
  return { ...summary, rows, events, accounts, types }
}

/** Source nice-step algorithm adapted to integer money units. Only ratios become Number. */
export function incomeAxis(maximum: bigint, alignedCount?: number) {
  const count = alignedCount ?? 5
  const intervals = BigInt(Math.max(1, count - 1))
  let magnitude = 1n
  while (magnitude * 10n * intervals <= maximum) magnitude *= 10n
  const multiplier =
    [10n, 20n, 25n, 50n, 100n].find(
      (m) => m * magnitude * intervals >= maximum * 10n,
    ) ?? 100n
  const step = (multiplier * magnitude + 9n) / 10n
  const size = alignedCount ?? Number(maximum / step) + 2
  const values = Array.from(
    { length: Math.max(2, size) },
    (_, i) => BigInt(i) * step,
  )
  const top = values.at(-1)!
  return {
    top,
    values,
    ticks: values.map((value) => Number((value * 1_000_000n) / top) / 10000),
  }
}
