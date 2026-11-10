/* eslint-disable react-refresh/only-export-components -- Compatibility barrel preserves upstream UI imports and exact-format hooks. */
export * from '../../holdings/ui'
export * from '@/vendor/wealthfolio/ui/components/ui/checkbox'
export * from '@/vendor/wealthfolio/ui/components/ui/dropdown-menu'
export * from '@/vendor/wealthfolio/ui/components/ui/tooltip'
export * from '@/vendor/wealthfolio/ui/components/ui/alert-dialog'
import { AmountDisplay } from '../../holdings/formatting'
import { useBalancePrivacy } from '../../holdings/compat'
import { useNumberFormatting } from '../../holdings/number-formatters'
import type { Exact } from '../../holdings/types'
export function PrivacyAmount({
  value,
  currency,
}: {
  value: Exact
  currency: string
}) {
  const { isBalanceHidden } = useBalancePrivacy()
  return (
    <AmountDisplay
      value={value}
      currency={currency}
      isHidden={isBalanceHidden}
    />
  )
}
export function useDateFormatting() {
  const formatter = useNumberFormatting()
  return {
    ...formatter,
    formatTime: (_date: string, _options?: Intl.DateTimeFormatOptions) => {
      void _date
      void _options
      return ''
    },
  }
}
