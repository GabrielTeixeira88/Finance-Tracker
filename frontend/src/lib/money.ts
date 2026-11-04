import { getLocale } from './preferences'
import { t } from './i18n'
// Intl accepts decimal strings without converting them to binary floating point.
// The cast bridges TypeScript's older Intl signature, not the runtime value.
export function formatMoney(
  value: string,
  currency: string,
  options: Parameters<typeof formatMoneyParts>[2] = {},
) {
  return formatMoneyParts(value, currency, options)
    .map((part) => part.value)
    .join('')
}

export function formatMoneyParts(
  value: string,
  currency: string,
  options: {
    locale?: string
    compact?: boolean
    minorUnits?: boolean
    currencyDisplay?: 'symbol' | 'code'
    fractionDigits?: number
  } = {},
) {
  const formatter = new Intl.NumberFormat(options.locale ?? getLocale(), {
    style: 'currency',
    currency,
    currencyDisplay: options.currencyDisplay ?? 'symbol',
    notation: options.compact ? 'compact' : 'standard',
    ...(options.compact
      ? { minimumFractionDigits: 0, maximumFractionDigits: 1 }
      : options.fractionDigits !== undefined
        ? {
            minimumFractionDigits: options.fractionDigits,
            maximumFractionDigits: options.fractionDigits,
          }
        : options.minorUnits
          ? {}
          : { maximumFractionDigits: 6 }),
  })
  const parts = formatter.formatToParts as unknown as (
    decimal: string,
  ) => Intl.NumberFormatPart[]
  return parts.call(formatter, value)
}

export function decimalUnits(value: string): bigint {
  if (!/^-?\d+(\.\d{1,6})?$/.test(value))
    throw new Error('Invalid decimal amount')
  const [whole, fraction = ''] = value.replace('-', '').split('.')
  return (
    (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'))) *
    (value.startsWith('-') ? -1n : 1n)
  )
}

export function subtractMoney(left: string, right: string): string {
  const units = decimalUnits(left) - decimalUnits(right)
  return unitsToMoney(units)
}

export function unitsToMoney(units: bigint): string {
  const absolute = units < 0n ? -units : units
  return `${units < 0n ? '-' : ''}${absolute / 1_000_000n}.${String(absolute % 1_000_000n).padStart(6, '0')}`
}

/** Exact label for a decimal ratio; chart coordinates may be rounded separately. */
export function formatRatioPercent(
  value: string | null,
  digits = 6,
  fixed = false,
): string {
  return value === null
    ? t('common:unavailable')
    : formatExactPercent(
        unitsToMoney(decimalUnits(value) * 100n),
        digits,
        fixed,
      )
}

/** Input is already percent units, not a ratio. No monetary/ratio Number coercion. */
export function formatExactPercent(
  value: string,
  digits = 6,
  fixed = false,
): string {
  const formatted = new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: digits,
    minimumFractionDigits: fixed ? digits : 0,
  }).format as unknown as (value: string) => string
  const parts = new Intl.NumberFormat(getLocale(), {
    style: 'percent',
  }).formatToParts(1)
  return parts
    .map((part) =>
      part.type === 'integer'
        ? formatted(value)
        : part.type === 'group'
          ? ''
          : part.value,
    )
    .join('')
}

export function formatDate(value: string): string {
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value,
  )
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(getLocale(), {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(date)
    : value
}

export function sumMoney(values: string[]) {
  return unitsToMoney(
    values.reduce((sum, value) => sum + decimalUnits(value), 0n),
  )
}

// Chart coordinates are dimensionless. Original decimal strings remain the display source.
export function chartCoordinates(points: { date: string; balance: string }[]) {
  const amounts = points.map((point) => decimalUnits(point.balance))
  const min = amounts.reduce((a, b) => (a < b ? a : b), amounts[0] ?? 0n)
  const max = amounts.reduce((a, b) => (a > b ? a : b), amounts[0] ?? 0n)
  return points.map((point, index) => ({
    ...point,
    time: Date.parse(`${point.date}T12:00:00Z`),
    coordinate:
      max === min
        ? 50
        : Number(((amounts[index] - min) * 10000n) / (max - min)) / 100,
  }))
}

export function activityPercent(
  amount: string,
  income: string,
  expenses: string,
): number {
  const total = decimalUnits(income) + decimalUnits(expenses)
  // Only the dimensionless, bounded display percentage becomes a Number.
  return total === 0n ? 0 : Number((decimalUnits(amount) * 100n) / total)
}
