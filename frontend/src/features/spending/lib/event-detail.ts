import type { EventReport } from '@/lib/life-events'
import type { SpendingWorkspaceData } from '../api'
import { dayAfter } from '@/lib/spending-period'
import {
  decimalUnits,
  unitsToMoney,
  sumMoney,
  subtractMoney,
} from '@/lib/money'
import { parseLocalDate, inclusiveDays } from './event-adapter'
export function eventDetailProjection(
  report: EventReport,
  history?: SpendingWorkspaceData,
) {
  const event = report.event,
    startDate = parseLocalDate(event.start_date),
    endDate = parseLocalDate(event.end_date),
    days = inclusiveDays(startDate, endDate)
  const calendar = (
    from: string,
    length: number,
    source: Map<string, string>,
  ) =>
    Array.from(
      { length },
      (_, index) => source.get(dayAfter(from, index)) ?? '0',
    )
  const own = new Map(report.daily.map((row) => [row.date, row.value])),
    all = new Map(history?.daily.map((row) => [row.date, row.spending]) ?? [])
  const beforeStart = dayAfter(event.start_date, -7),
    afterEnd = dayAfter(event.end_date, 3)
  const beforeSeries =
    history &&
    history.start <= beforeStart &&
    history.end_exclusive > event.start_date
      ? calendar(beforeStart, 7, all)
      : []
  const afterSeries =
    history && history.end_exclusive > afterEnd
      ? calendar(dayAfter(event.end_date), 3, all)
      : []
  const avg = (series: string[]) =>
    series.length
      ? unitsToMoney(decimalUnits(sumMoney(series)) / BigInt(series.length))
      : null
  const beforeAvg = avg(beforeSeries),
    afterAvg = avg(afterSeries)
  const baseline =
    beforeAvg !== null && decimalUnits(beforeAvg) > 0n ? beforeAvg : null
  const expected =
    baseline === null
      ? null
      : unitsToMoney(decimalUnits(baseline) * BigInt(days))
  const lift =
    expected === null || report.actual_cost === null
      ? null
      : subtractMoney(report.actual_cost, expected)
  const pct = (value: string | null, base: string | null) =>
    value === null || base === null || decimalUnits(base) <= 0n
      ? null
      : unitsToMoney(
          ((decimalUnits(value) - decimalUnits(base)) * 100000000n) /
            decimalUnits(base),
        )
  const dailyDuring =
    report.actual_cost === null
      ? null
      : unitsToMoney(decimalUnits(report.actual_cost) / BigInt(days))
  const keys = [event.start_date, event.end_date, ...own.keys()].sort(),
    chartStart = keys[0],
    chartEnd = keys.at(-1)!
  const visibleEnd = chartEnd < report.as_of ? chartEnd : report.as_of
  const taggedLength =
    chartStart <= visibleEnd
      ? inclusiveDays(parseLocalDate(chartStart), parseLocalDate(visibleEnd))
      : 0
  const tagged = {
    series: report.complete ? calendar(chartStart, taggedLength, own) : [],
    inWindow: Array.from({ length: taggedLength }, (_, index) => {
      const date = dayAfter(chartStart, index)
      return date >= event.start_date && date <= event.end_date
    }),
    chartStartDate: parseLocalDate(chartStart),
    chartEndDate: parseLocalDate(visibleEnd),
  }
  const peak = report.complete
    ? report.daily
        .filter((row) => decimalUnits(row.value) > 0n)
        .sort((a, b) =>
          decimalUnits(a.value) > decimalUnits(b.value) ? -1 : 1,
        )[0]
    : undefined
  return {
    startDate,
    endDate,
    days,
    beforeSeries,
    afterSeries,
    beforeAvg,
    afterAvg,
    baseline,
    expected,
    lift,
    dailyDuring,
    dailyDeltaPct: pct(dailyDuring, baseline),
    hangoverPct: pct(afterAvg, baseline),
    dailySeries: report.complete
      ? calendar(
          event.start_date,
          Math.min(
            days,
            Math.max(0, inclusiveDays(startDate, parseLocalDate(report.as_of))),
          ),
          own,
        )
      : [],
    tagged,
    peak: peak ? { date: parseLocalDate(peak.date), amount: peak.value } : null,
    outOfRange: report.daily
      .filter((row) => row.date < event.start_date || row.date > event.end_date)
      .map((row) => row.date),
  }
}
