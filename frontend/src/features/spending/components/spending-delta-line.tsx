import { useBalancePrivacy } from '../compat'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/features/spending/components/spending-delta-line.tsx; see THIRD_PARTY_NOTICES.md.
import { decimalUnits, formatExactPercent } from '@/lib/money'
import { useTranslation } from 'react-i18next'
import { GainAmount } from '../ui'

interface SpendingDeltaLineProps {
  /** This period's spending minus the prior period's. */
  delta: string
  currency: string
  /** The change in percentage units, supplied by the local API, or null to leave it out. */
  deltaPct: string | null
}

/**
 * The Spending hero's change line: amount | percent | "from prior period", as on
 * Investments and Net Worth, with the colours swapped because less spending is the good
 * direction. Spending up or down is a status, not a gain or loss, so the line pins the
 * gain and loss colours to success and destructive and the Gain and loss colours setting
 * leaves it alone.
 */
export function SpendingDeltaLine({
  delta,
  currency,
  deltaPct,
}: SpendingDeltaLineProps) {
  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()

  if (decimalUnits(delta) === 0n) {
    return (
      <span className="text-muted-foreground lg:text-md text-sm font-light">
        {t('wfSpending:tabContent.aboutSame')}
      </span>
    )
  }

  return (
    // `contents`: the parts stay items of the row the line sits in.
    <div className="contents [--gain:var(--success)] [--loss:var(--destructive)]">
      <GainAmount
        className="lg:text-md text-sm font-light"
        value={delta}
        currency={currency}
        displayCurrency={false}
        invertColor
      />
      {deltaPct !== null && (
        <>
          <div className="border-secondary my-1 self-stretch border-e pe-2" />
          <span
            className={
              decimalUnits(deltaPct) > 0n
                ? 'text-destructive text-sm font-light tabular-nums'
                : 'text-success text-sm font-light tabular-nums'
            }
          >
            {isBalanceHidden ? '••••' : formatExactPercent(deltaPct)}
          </span>
        </>
      )}
      <span className="lg:text-md text-muted-foreground ms-1 text-sm font-light">
        {t('wfSpending:tabContent.fromPriorPeriod')}
      </span>
    </div>
  )
}
