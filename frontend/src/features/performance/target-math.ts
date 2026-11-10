import { decimalUnits, formatExactPercent, unitsToMoney } from '@/lib/money'
export const bpsPercent = (value: string | number | null) =>
  value === null
    ? '—'
    : formatExactPercent(unitsToMoney(decimalUnits(String(value)) / 100n))
export function inputBps(value: string) {
  if (
    !/^\d{1,3}(\.\d{1,6})?$/.test(value) ||
    decimalUnits(value) % 10000n !== 0n
  )
    throw Error('Use 0–100 with at most two decimal places')
  const bps = decimalUnits(value) / 10000n
  if (bps > 10000n) throw Error('Percentage cannot exceed 100')
  return Number(bps) // bounded dimensionless basis points, never money
}

export const bpsPoints = (value: string | number | null) =>
  value === null ? '—' : bpsPercent(value).replace('%', ' pp')
