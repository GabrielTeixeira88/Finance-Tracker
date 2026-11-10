import type { ReactNode } from 'react'
import {
  formatMoney,
  formatDecimal,
  formatRatioPercent,
  decimalUnits,
} from '@/lib/money'
import { Badge } from '@/vendor/wealthfolio/ui/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Exact } from './types'

type MoneyProps = {
  value?: Exact
  currency: string
  isHidden?: boolean
  className?: string
  displayCurrency?: boolean
  colorFormat?: boolean
  [key: string]: unknown
}
export function AmountDisplay({
  value,
  currency,
  isHidden,
  className,
  colorFormat,
}: MoneyProps) {
  const tone =
    colorFormat && !isHidden && value != null
      ? decimalUnits(value) > 0n
        ? 'positive'
        : decimalUnits(value) < 0n
          ? 'negative'
          : ''
      : ''
  return (
    <span
      className={cn(
        'tabular-nums tracking-tight whitespace-nowrap',
        tone,
        className,
      )}
      data-exact={isHidden ? undefined : value}
    >
      {isHidden ? '••••' : value == null ? '—' : formatMoney(value, currency)}
    </span>
  )
}
export const PriceDisplay = AmountDisplay
export function QuantityDisplay({
  value,
  isHidden,
}: {
  value: Exact
  isHidden?: boolean
}) {
  return (
    <span className="tabular-nums">
      {isHidden ? '••••' : value === null ? '—' : formatDecimal(value)}
    </span>
  )
}
export function HoldingPerformancePercent({
  value,
  variant,
  className,
  invertColor = false,
}: {
  value?: Exact
  variant?: string
  className?: string
  animated?: boolean
  invertColor?: boolean
}) {
  const text = value == null ? '—' : formatRatioPercent(value, 2, true)
  const tone =
    value == null || decimalUnits(value) === 0n
      ? ''
      : decimalUnits(value) > 0n !== invertColor
        ? 'positive'
        : 'negative'
  return variant === 'badge' ? (
    <Badge variant="secondary" className={cn(tone, className)}>
      {text}
    </Badge>
  ) : (
    <span className={cn('tabular-nums', tone, className)}>{text}</span>
  )
}
export const GainPercent = HoldingPerformancePercent
export function TickerAvatar({
  symbol,
  className,
}: {
  symbol: string
  className?: string
  exchangeMic?: string
  instrumentType?: string
  assetId?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
        className,
      )}
    >
      {symbol.replace('SIM-', '').slice(0, 3)}
    </span>
  )
}
export function SkeletonLabel({ children }: { children: ReactNode }) {
  return <span>{children}</span>
}
