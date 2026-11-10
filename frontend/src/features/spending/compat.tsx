import { canonicalRoute, workspaceRoute } from '@/lib/route-aliases'
/* eslint-disable react-refresh/only-export-components -- Exact source compatibility boundary. */
import './i18n'
import type { AnchorHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { decimalUnits, unitsToMoney, formatMoney } from '@/lib/money'
import { useBalancePrivacy } from '../holdings/compat'
export { useBalancePrivacy } from '../holdings/compat'
export {
  useNumberFormatting,
  useAmountFormatting,
  useDateFormatting,
} from '../holdings/number-formatters'
export function exactAbs(value: string) {
  const units = decimalUnits(value)
  return unitsToMoney(units < 0n ? -units : units)
}
export function exactAbsUnits(left: string, right: string) {
  const delta = decimalUnits(left) - decimalUnits(right)
  return delta < 0n ? -delta : delta
}
export function positiveMoney(value: string) {
  return decimalUnits(value) > 0n ? value : '0'
}
/** Coordinates only: divide exact integer amounts before converting a bounded ratio. */
export function safePercent(value: string, total: string) {
  const denominator = decimalUnits(total)
  if (denominator <= 0n) return 0
  const numerator = decimalUnits(value)
  const bounded =
    numerator < 0n ? 0n : numerator > denominator ? denominator : numerator
  return Number((bounded * 1000000n) / denominator) / 1000000
}
export function exactRatio(value: string, total: string) {
  const denominator = decimalUnits(total)
  return denominator > 0n
    ? unitsToMoney((decimalUnits(value) * 1000000n) / denominator)
    : null
}
export function GainAmount({
  value,
  currency,
  className,
  invertColor = false,
}: {
  value: string
  currency: string
  className?: string
  invertColor?: boolean
  displayCurrency?: boolean
}) {
  const { isBalanceHidden } = useBalancePrivacy()
  const positive = decimalUnits(value) > 0n
  return (
    <span
      className={cn(
        'tabular-nums',
        !isBalanceHidden &&
          decimalUnits(value) !== 0n &&
          (positive !== invertColor ? 'text-success' : 'text-destructive'),
        className,
      )}
    >
      {isBalanceHidden ? '••••' : formatMoney(value, currency)}
    </span>
  )
}
/** Preserve local hash routing and already-migrated Activities; no second router. */
export function Link({
  to,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const url = new URL(to.replace(/^#/, ''), 'https://local.invalid')
  let path = url.pathname.replace(/^\//, '')
  const params = new URLSearchParams(url.search)
  if (path === 'spending/budget') {
    path = 'spending'
    params.set('view', 'Budgets')
  }
  if (path === 'insights' && params.get('tab') === 'spending') {
    path = 'spending'
    params.set(
      'view',
      params.get('stage') === 'when' ? 'Life Events' : 'Insights',
    )
  }
  if (path === 'activities') {
    for (const [source, target] of [
      ['from', 'date_from'],
      ['to', 'date_to'],
      ['category', 'category_id'],
    ]) {
      if (params.has(source)) {
        params.set(target, params.get(source)!)
        params.delete(source)
      }
    }
    if (params.get('status') === 'uncategorized') {
      params.set('uncategorized', 'true')
      params.delete('status')
    }
  }
  if (path.startsWith('settings/spending')) {
    params.set('view', path.endsWith('rules') ? 'Rules' : 'Categories')
    path = 'settings'
  }
  const mapped = workspaceRoute(path, params)
  const result = canonicalRoute(mapped.path, mapped.params)
  return (
    <a
      {...props}
      href={
        '#/' + result.path + (result.params.size ? '?' + result.params : '')
      }
    />
  )
}
