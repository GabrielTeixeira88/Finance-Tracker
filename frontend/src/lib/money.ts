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
