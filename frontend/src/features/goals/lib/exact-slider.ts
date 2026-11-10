import { decimalUnits, unitsToMoney } from '@/lib/money'

/** Financial amounts remain exact. Only the bounded slider coordinate is numeric. */
export function sliderPosition(value: string, min: string, max: string) {
  const lower = decimalUnits(min),
    upper = decimalUnits(max)
  if (upper <= lower) return 0
  const units = decimalUnits(value)
  const clamped = units < lower ? lower : units > upper ? upper : units
  return Number(((clamped - lower) * 10_000n) / (upper - lower))
}

/** Moving the slider is an explicit scenario edit, never a ledger mutation. */
export function sliderAmount(
  position: string,
  min: string,
  max: string,
  step: string,
) {
  if (!/^\d{1,5}$/.test(position)) throw new Error('Invalid slider position')
  const coordinate = BigInt(position)
  const lower = decimalUnits(min),
    upper = decimalUnits(max),
    increment = decimalUnits(step)
  if (coordinate > 10_000n || lower < 0n || upper < lower || increment <= 0n)
    throw new Error('Invalid slider range')
  const offset = ((upper - lower) * coordinate) / 10_000n
  const rounded = lower + ((offset + increment / 2n) / increment) * increment
  return unitsToMoney(rounded > upper ? upper : rounded)
}

/** Upstream value-relative slider extent, using integer arithmetic. */
export function sliderMaxFor(value: string, base: string, increment: string) {
  const units = decimalUnits(value),
    step = decimalUnits(increment)
  if (units < 0n || step <= 0n) throw new Error('Invalid slider extent')
  const next = ((units + step + step - 1n) / step) * step
  return unitsToMoney(next > decimalUnits(base) ? next : decimalUnits(base))
}
