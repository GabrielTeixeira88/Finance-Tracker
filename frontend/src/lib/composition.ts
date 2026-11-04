import { decimalUnits } from './money'
export type CompositionItem = {
  name: string
  value: string | null
  id?: string
  weight?: string | null
}
export const compositionColors = [
  'var(--chart-line)',
  'var(--chart-secondary)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

/** Only bounded dimensionless weights enter Recharts. Never coerce money to Number. */
export function compositionData(items: CompositionItem[], complete: boolean) {
  if (
    !complete ||
    items.some((row) => row.value === null || decimalUnits(row.value) < 0n)
  )
    return null
  const total = items.reduce((sum, row) => sum + decimalUnits(row.value!), 0n)
  if (total === 0n) return []
  return items.map((row, index) => ({
    ...row,
    // Recharts uses `value` internally for geometry; preserve money under its own key.
    exactValue: row.value!,
    coordinate:
      Number((decimalUnits(row.value!) * 1_000_000_000n) / total) / 10_000_000,
    color: compositionColors[index % compositionColors.length],
  }))
}
