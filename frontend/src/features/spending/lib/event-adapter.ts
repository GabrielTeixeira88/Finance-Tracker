import { t as appTranslation } from '@/lib/i18n'
import { createContext, useContext } from 'react'
import type { EventReport } from '@/lib/life-events'
import type { SpendingWorkspaceData } from '../api'
import {
  decimalUnits,
  unitsToMoney,
  sumMoney,
  subtractMoney,
} from '@/lib/money'
import { safePercent } from '../compat'
import { getLocale } from '@/lib/preferences'
import { useDateFormatting as useBaseDates } from '@/features/holdings/number-formatters'
export { useBalancePrivacy } from '../compat'
export { useIsMobileViewport } from '@/features/holdings/compat'
export { useDateFnsLocale } from './calendar-adapter'
export const parseLocalDate = (date: string) => new Date(date + 'T00:00:00')
export const calendarDateFromLocalDate = (date: Date) => date
export const getZonedDateParts = (date: Date, _timezone?: string | null) => (
  void _timezone,
  {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
)
export const inclusiveDays = (start: Date, end: Date) =>
  Math.round((end.getTime() - start.getTime()) / 86400000) + 1
export type EventSpendingSummary = {
  eventId: string
  eventName: string
  eventTypeId: string
  eventTypeName: string
  eventTypeColor: string | null
  startDate: string
  endDate: string
  totalSpending: string | null
  transactionCount: number
  currency: string
}
export function sourceEvents(reports: EventReport[]): EventSpendingSummary[] {
  const colors: Record<string, string> = {
    blue: '#5B83B4',
    green: '#659877',
    amber: '#B1904F',
    rose: '#AD687E',
    violet: '#8B73B3',
  }
  return reports.map((row) => ({
    eventId: row.event.id,
    eventName: row.event.name,
    eventTypeId: row.event.event_type,
    eventTypeName: row.event.event_type,
    eventTypeColor: colors[row.event.color] ?? '#7B8794',
    startDate: row.event.start_date,
    endDate: row.event.end_date,
    totalSpending: row.actual_cost,
    transactionCount: row.transaction_count,
    currency: row.event.currency,
  }))
}
export const getEventTypeLabel = (_t: unknown, id: string, name: string) =>
  name === id &&
  [
    'TRAVEL',
    'HOME',
    'WEDDING',
    'VEHICLE',
    'FESTIVAL',
    'EDUCATION',
    'OTHER',
  ].includes(id)
    ? appTranslation('parity:' + id.toLowerCase())
    : name
export const eventDialogContext = createContext({
  openEventDialog: (_options?: {
    prefill?: { startDate?: Date; endDate?: Date }
    onCreated?: (event: { id: string }) => void
  }) => {
    void _options
  },
})
export const useEventDialog = () => useContext(eventDialogContext)
export function useDateFormatting() {
  const base = useBaseDates()
  return {
    ...base,
    formatCalendarDateRange: (
      start: Date,
      end: Date,
      options?: Intl.DateTimeFormatOptions,
    ) =>
      new Intl.DateTimeFormat(
        getLocale(),
        options ?? { dateStyle: 'medium' },
      ).formatRange(start, end),
  }
}
export type FormattingApi = ReturnType<typeof useDateFormatting>
export function eventAggregate(
  events: EventSpendingSummary[],
  report: SpendingWorkspaceData,
) {
  const eventDays = new Set(
    report.daily
      .filter((row) =>
        events.some(
          (event) => event.startDate <= row.date && event.endDate >= row.date,
        ),
      )
      .map((row) => row.date),
  )
  const baseline = report.daily.filter((row) => !eventDays.has(row.date))
  const normalAmount = baseline.length
    ? unitsToMoney(
        decimalUnits(sumMoney(baseline.map((row) => row.spending))) /
          BigInt(baseline.length),
      )
    : null
  const totalSpent = events.every((event) => event.totalSpending !== null)
    ? sumMoney(events.map((event) => event.totalSpending!))
    : null
  const expected =
    normalAmount === null
      ? null
      : unitsToMoney(decimalUnits(normalAmount) * BigInt(eventDays.size))
  const lift =
    expected === null || totalSpent === null
      ? null
      : subtractMoney(totalSpent, expected)
  const max = report.daily.reduce(
    (high, row) =>
      decimalUnits(row.spending) > decimalUnits(high) ? row.spending : high,
    '0',
  )
  return {
    normalAmount,
    totalSpent,
    lift,
    totalEventDays: eventDays.size,
    normalPace: normalAmount === null ? 0 : safePercent(normalAmount, max),
    series: report.daily.map(
      (row) =>
        (decimalUnits(row.spending) < 0n ? -1 : 1) *
        safePercent(
          row.spending.startsWith('-') ? row.spending.slice(1) : row.spending,
          max,
        ),
    ),
  }
}
