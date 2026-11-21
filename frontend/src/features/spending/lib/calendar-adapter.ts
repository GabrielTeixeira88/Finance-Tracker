import { enUS, ptBR, es } from 'date-fns/locale'
import { getLocale } from '@/lib/preferences'
import { validDay } from '@/lib/spending-period'
export { cn } from '@/lib/utils'
export type DateRange = { from?: Date; to?: Date }
export const REPORTS_PERIODS = [
  'MTD',
  'LAST_MONTH',
  '3M',
  '6M',
  'YTD',
  '1Y',
] as const
export type ReportsPeriod = (typeof REPORTS_PERIODS)[number]
export const SPENDING_RANGE_FROM_PARAM = 'start'
export const SPENDING_RANGE_TO_PARAM = 'end'
export function useDateFnsLocale() {
  const locale = getLocale()
  return locale.startsWith('pt') ? ptBR : locale.startsWith('es') ? es : enUS
}
export function formatDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function parseSpendingDate(value: string | null) {
  return value && validDay(value) ? new Date(value + 'T12:00:00') : null
}
export function spendingRangeFromParams(params: URLSearchParams) {
  const from = parseSpendingDate(params.get('start')),
    to = parseSpendingDate(params.get('end'))
  return from && to && from <= to ? { from, to } : undefined
}
export function monthRange(month: string): DateRange {
  const [year, index] = month.split('-').map(Number)
  return {
    from: new Date(year, index - 1, 1, 12),
    to: new Date(year, index, 0, 12),
  }
}
