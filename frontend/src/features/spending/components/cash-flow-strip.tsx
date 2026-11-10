// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/features/spending/components/cash-flow-strip.tsx; see THIRD_PARTY_NOTICES.md.
import { exactAbs } from '../compat'
import { decimalUnits, sumMoney, unitsToMoney } from '@/lib/money'
/**
 * KPI strip rendered above the spending-tab chart: income / spending / saving / net.
 */
import { useBalancePrivacy } from '../compat'
import { cn } from '@/lib/utils'
import { Skeleton, useAmountFormatting } from '../ui'
import { useTranslation } from 'react-i18next'
import { Link } from '../compat'

export interface CashFlowStripProps {
  income: string
  spending: string
  /** Money set aside into the Savings taxonomy (transfers to investing accounts). */
  saving?: string
  /** Money brought back from those accounts. The Saving figure shows the net. */
  fromSavings?: string
  currency: string
  isLoading?: boolean
  incomeHref?: string
  spendingHref?: string
  savingHref?: string
}

export function CashFlowStrip({
  income,
  spending,
  saving = '0',
  fromSavings = '0',
  currency,
  isLoading,
  incomeHref,
  spendingHref,
  savingHref,
}: CashFlowStripProps) {
  const { t } = useTranslation()
  const net = sumMoney([
    income,
    unitsToMoney(-decimalUnits(spending)),
    unitsToMoney(-decimalUnits(saving)),
    fromSavings,
  ])
  const netPositive = decimalUnits(net) >= 0n
  // Net saving goes negative when more came back from savings than went in;
  // it shows with its sign rather than clamped, so the strip still adds up.
  const netSaving = unitsToMoney(
    decimalUnits(saving) - decimalUnits(fromSavings),
  )
  const showSaving = decimalUnits(saving) > 0n || decimalUnits(fromSavings) > 0n

  if (isLoading) {
    return (
      <div
        role="group"
        aria-label={t('spendingMigration:cashFlowSummary')}
        className="flex flex-wrap items-end gap-6 sm:gap-8"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      role="group"
      aria-label={t('spendingMigration:cashFlowSummary')}
      className="flex flex-wrap items-end gap-6 sm:gap-8"
    >
      <KpiStat
        label={t('wfSpending:cashFlow.income')}
        value={income}
        sign="+"
        currency={currency}
        tone="success"
        href={incomeHref}
      />
      <KpiStat
        label={t('wfSpending:cashFlow.spending')}
        value={spending}
        currency={currency}
        tone="muted"
        href={spendingHref}
      />
      {showSaving && (
        <KpiStat
          label={t('wfSpending:cashFlow.netSaved')}
          value={exactAbs(netSaving)}
          sign={decimalUnits(netSaving) < 0n ? '−' : undefined}
          currency={currency}
          tone="saving"
          href={savingHref}
        />
      )}
      <KpiStat
        label={t('spendingMigration:afterSaving')}
        value={exactAbs(net)}
        sign={netPositive ? '+' : '−'}
        currency={currency}
        tone={netPositive ? 'success' : 'destructive'}
      />
    </div>
  )
}

function KpiStat({
  label,
  value,
  sign,
  currency,
  tone,
  href,
}: {
  label: string
  value: string
  sign?: '+' | '−'
  currency: string
  tone: 'success' | 'destructive' | 'muted' | 'saving'
  href?: string
}) {
  const formatting = useAmountFormatting()
  const { isBalanceHidden } = useBalancePrivacy()
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'saving'
          ? 'text-[var(--spending-saving)]'
          : 'text-foreground'
  const content = (
    <>
      <span className="text-muted-foreground text-2xs font-light tracking-wide">
        {label}
      </span>
      <span className={cn('text-sm font-medium tabular-nums', toneClass)}>
        {sign}
        {isBalanceHidden
          ? '••••'
          : formatting.formatCompactAmount(value, currency)}
      </span>
    </>
  )

  if (href) {
    return (
      <Link
        to={href}
        className="hover:bg-foreground/5 focus-visible:ring-ring -m-1 flex flex-col rounded-md p-1 transition-colors focus-visible:ring-1 focus-visible:outline-none"
      >
        {content}
      </Link>
    )
  }

  return <div className="flex flex-col">{content}</div>
}
