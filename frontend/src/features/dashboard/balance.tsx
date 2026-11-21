// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 dashboard/balance.tsx and dashboard-content.tsx.
// Exact Money replaces NumberFlow: monetary numbers are never coerced or tweened.
import { Eye, EyeOff } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/vendor/wealthfolio/ui/components/ui/popover'
import { Money } from '@/components/primitives'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { t } from '@/lib/i18n'
import { decimalUnits, formatExactPercent } from '@/lib/money'

export function Gain({
  value,
  currency,
}: {
  value: string | null
  currency: string
}) {
  return value === null ? (
    <span className="text-muted-foreground">{t('common:unavailable')}</span>
  ) : (
    <Money
      value={value}
      currency={currency}
      prefix={decimalUnits(value) > 0n ? '+' : ''}
      tone={
        decimalUnits(value) > 0n
          ? 'positive'
          : decimalUnits(value) < 0n
            ? 'negative'
            : 'neutral'
      }
    />
  )
}
export function Return({ value }: { value: string | null }) {
  const { hidden } = useFinancialPrivacy()
  return (
    <span className="tabular-nums">
      {hidden
        ? '••••'
        : value === null
          ? t('common:unavailable')
          : formatExactPercent(value, 1)}
    </span>
  )
}
export function Balance({
  value,
  currency,
  sourceDetails,
  sourceLabel,
}: {
  value: string | null
  currency: string
  sourceDetails?: ReactNode
  sourceLabel?: string
}) {
  const privacy = useFinancialPrivacy()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1
        className="font-heading text-display font-normal"
        data-testid="portfolio-balance"
      >
        {sourceDetails ? (
          <Popover>
            <PopoverTrigger
              render={
                <button
                  aria-label={sourceLabel}
                  className="dashboard-balance-trigger"
                />
              }
            >
              {value === null ? (
                t('common:unavailable')
              ) : (
                <Money value={value} currency={currency} />
              )}
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="max-w-sm space-y-2 text-xs"
            >
              {sourceDetails}
            </PopoverContent>
          </Popover>
        ) : value === null ? (
          t('common:unavailable')
        ) : (
          <Money value={value} currency={currency} />
        )}
      </h1>
      <button
        className="net-worth-privacy"
        onClick={privacy.toggle}
        aria-pressed={privacy.hidden}
        aria-label={t(
          privacy.hidden ? 'networth:show_balances' : 'networth:hide_balances',
        )}
      >
        {privacy.hidden ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
