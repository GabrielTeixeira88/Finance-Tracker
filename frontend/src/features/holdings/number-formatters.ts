import { formatMoney, formatRatioPercent, formatDecimal } from '@/lib/money'
import { getLocale } from '@/lib/preferences'
import type { Exact } from './types'
export type FormattingApi = {
  formatDecimal: (value: Exact) => string
  formatPercent: (value: Exact, options?: { digits: number }) => string
  formatPrice: (value: Exact, currency: string) => string
  formatAmount: (value: Exact, currency: string) => string
  formatCompactAmount: (value: Exact, currency: string) => string
  formatCalendarDate: (
    value: string | Date | null,
    options?: Intl.DateTimeFormatOptions,
  ) => string
}
export function useNumberFormatting(): FormattingApi {
  return formatting
}
export const useAmountFormatting = useNumberFormatting
export const useDateFormatting = useNumberFormatting
const formatting: FormattingApi = {
  formatDecimal: (value) => (value === null ? '—' : formatDecimal(value)),
  formatPercent: (value) => formatRatioPercent(value, 2, true),
  formatPrice: (value, currency) =>
    value === null ? '—' : formatMoney(value, currency),
  formatAmount: (value, currency) =>
    value === null ? '—' : formatMoney(value, currency),
  formatCompactAmount: (value, currency) =>
    value === null ? '—' : formatMoney(value, currency),
  formatCalendarDate: (value, options) =>
    value === null
      ? '—'
      : new Intl.DateTimeFormat(
          getLocale(),
          options ?? { dateStyle: 'medium' },
        ).format(
          typeof value === 'string'
            ? new Date(value.slice(0, 10) + 'T12:00:00')
            : value,
        ),
}
