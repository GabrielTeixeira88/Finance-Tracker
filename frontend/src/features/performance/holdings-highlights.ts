// SPDX-License-Identifier: AGPL-3.0-only
// Source: 92b4647 holdings-highlights, adapted to exact native currencies.
import type { Holding } from '@/features/holdings/types'
import { decimalUnits } from '@/lib/money'
export function getTopMovers(holdings: Holding[], mode: 'amount' | 'percent') {
  const value = (h: Holding) =>
    mode === 'amount' ? h.dayChange.local : h.dayChangePct
  const ranked = holdings
    .filter(
      (h) =>
        h.holdingType === 'SECURITY' &&
        !h.isClosed &&
        decimalUnits(h.quantity) > 0n &&
        h.instrument?.id &&
        value(h) !== null &&
        decimalUnits(value(h)!) !== 0n,
    )
    .sort((a, b) =>
      decimalUnits(value(a)!) > decimalUnits(value(b)!)
        ? -1
        : decimalUnits(value(a)!) < decimalUnits(value(b)!)
          ? 1
          : a.id.localeCompare(b.id),
    )
  return {
    gainers: ranked.filter((h) => decimalUnits(value(h)!) > 0n).slice(0, 3),
    losers: ranked
      .filter((h) => decimalUnits(value(h)!) < 0n)
      .reverse()
      .slice(0, 3),
  }
}
