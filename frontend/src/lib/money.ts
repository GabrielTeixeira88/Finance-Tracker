// Intl accepts decimal strings without converting them to binary floating point.
// The cast bridges TypeScript's older Intl signature, not the runtime value.
export function formatMoney(
  value: string,
  currency: string,
  options: {
    locale?: string
    compact?: boolean
    currencyDisplay?: 'symbol' | 'code'
  } = {},
) {
  const formatter = new Intl.NumberFormat(
    options.locale ?? navigator.language,
    {
      style: 'currency',
      currency,
      currencyDisplay: options.currencyDisplay ?? 'symbol',
      notation: options.compact ? 'compact' : 'standard',
      ...(options.compact
        ? { minimumFractionDigits: 0, maximumFractionDigits: 1 }
        : { maximumFractionDigits: 6 }),
    },
  )
  const parts = formatter.formatToParts as unknown as (
    decimal: string,
  ) => Intl.NumberFormatPart[]
  return parts
    .call(formatter, value)
    .map((part) => part.value)
    .join('')
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
  const absolute = units < 0n ? -units : units
  return `${units < 0n ? '-' : ''}${absolute / 1_000_000n}.${String(absolute % 1_000_000n).padStart(6, '0')}`
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
