import { useRoute, navigateTo } from '@/lib/navigation'
import {
  spendingPeriod,
  spendingRanges,
  validDay,
  dayAfter,
  type SpendingRange,
} from '@/lib/spending-period'
import { useQuery } from '@tanstack/react-query'
import { getSpendingWorkspace } from './api'
import { formatDateISO, type ReportsPeriod } from './lib/calendar-adapter'

export function useSpendingPeriod(asOf: string, currency: string) {
  const route = useRoute()
  const from = route.params.get('start') ?? '',
    until = route.params.get('end') ?? ''
  const valid =
    validDay(from) && validDay(until) && from <= until && until <= asOf
  const period = valid
    ? { start: from, end: until }
    : spendingPeriod('MTD', asOf)
  const selected = spendingRanges.find((range) => {
    const dates = spendingPeriod(range, asOf)
    return dates.start === period.start && dates.end === period.end
  })
  const sourcePeriod: ReportsPeriod | null =
    selected === 'LAST' ? 'LAST_MONTH' : (selected ?? null)
  const change = (next: { start: string; end: string }) =>
    navigateTo('Budget', undefined, {
      ...Object.fromEntries(route.params),
      ...next,
    })
  const data = useQuery({
    queryKey: ['spending-workspace', period.start, period.end, currency, asOf],
    queryFn: ({ signal }) =>
      getSpendingWorkspace(
        period.start,
        dayAfter(period.end),
        asOf,
        currency,
        signal,
      ),
  })
  return {
    period,
    sourcePeriod,
    data,
    selector: {
      value: sourcePeriod,
      onValueChange: (next: ReportsPeriod) =>
        change(
          spendingPeriod(
            (next === 'LAST_MONTH' ? 'LAST' : next) as SpendingRange,
            asOf,
          ),
        ),
      customMonth: null,
      customRange: sourcePeriod
        ? undefined
        : {
            from: new Date(period.start + 'T12:00:00'),
            to: new Date(period.end + 'T12:00:00'),
          },
      maxMonth: asOf.slice(0, 7),
      onCustomMonthChange: (month: string | null) => {
        if (!month) return change(spendingPeriod('MTD', asOf))
        const [year, index] = month.split('-').map(Number)
        const end = formatDateISO(new Date(year, index, 0, 12))
        change({ start: month + '-01', end: end < asOf ? end : asOf })
      },
      onCustomRangeChange: (range: { from?: Date; to?: Date } | undefined) => {
        if (!range) return change(spendingPeriod('MTD', asOf))
        if (range.from && range.to) {
          const end = formatDateISO(range.to)
          if (end <= asOf) change({ start: formatDateISO(range.from), end })
        }
      },
    },
  }
}

export function activityHref(
  start: string,
  end: string,
  currency: string,
  extra: Record<string, string> = {},
) {
  return (
    '/activities?' +
    new URLSearchParams({
      tab: 'spending',
      spending_only: 'true',
      date_from: start,
      date_to: end,
      currency,
      ...extra,
    })
  )
}
