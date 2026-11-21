// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 when-you-spend-card.tsx: source card/row/cell geometry.
// Calendar-date columns replace unsupported transaction hours. Exact signed labels are retained.
import { useTranslation } from 'react-i18next'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'
import type { SpendingWorkspaceData } from '../../../api'
import { dayAfter } from '@/lib/spending-period'
import { decimalUnits, sumMoney, formatMoney } from '@/lib/money'
import { useBalancePrivacy, safePercent, exactAbs } from '../../../compat'
import { PrivacyAmount } from '../../../ui'
import { activityHref } from '../../../period-adapter'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export function WhenYouSpendCard({
  report,
}: {
  report: SpendingWorkspaceData
}) {
  const { t } = useTranslation(),
    { isBalanceHidden } = useBalancePrivacy()
  const first = report.daily[0]?.date
  if (!first) return null
  const offset = (new Date(first + 'T12:00:00').getDay() + 6) % 7
  const start = dayAfter(first, -offset),
    weeks = Math.ceil((report.daily.length + offset) / 7)
  const amounts = new Map(report.daily.map((row) => [row.date, row.spending]))
  const max = report.daily.reduce(
    (high, row) =>
      decimalUnits(exactAbs(row.spending)) > decimalUnits(high)
        ? exactAbs(row.spending)
        : high,
    '0',
  )
  return (
    <Card className="p-5">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-foreground text-base font-semibold tracking-tight">
            {t('wfSpending:whenYouSpend.title')}
          </h3>
          <p className="text-muted-foreground text-xs">
            {t('spendingMigration:recordedDays')}
          </p>
        </div>
        <span className="text-muted-foreground/70 text-2xs uppercase tracking-[0.12em]">
          {t('spendingMigration:weekdayTotal')}
        </span>
      </header>
      <div className="overflow-x-auto">
        <div
          className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1"
          style={{ minWidth: Math.max(280, weeks * 24) }}
        >
          <div />
          <div
            className="text-muted-foreground/70 text-2xs grid"
            style={{ gridTemplateColumns: `repeat(${weeks},minmax(0,1fr))` }}
          >
            {Array.from({ length: weeks }, (_, week) => (
              <span key={week}>
                {week % 4 === 0 ? dayAfter(start, week * 7).slice(5) : ''}
              </span>
            ))}
          </div>
          <div />
          {DAYS.map((day, index) => (
            <div key={day} className="contents">
              <span className="text-muted-foreground/80 text-2xs pe-1 text-end">
                {t('wfSpending:dayOfWeek.' + day)}
              </span>
              <div
                className="grid gap-[3px]"
                style={{
                  gridTemplateColumns: `repeat(${weeks},minmax(0,1fr))`,
                }}
              >
                {Array.from({ length: weeks }, (_, week) => {
                  const date = dayAfter(start, week * 7 + index),
                    amount = amounts.get(date)
                  const label =
                    date +
                    ' · ' +
                    (isBalanceHidden
                      ? '••••'
                      : formatMoney(amount ?? '0', report.currency))
                  return amount === undefined ? (
                    <span key={date} />
                  ) : (
                    <button
                      key={date}
                      type="button"
                      className="h-5 sm:h-6 rounded-[3px] transition-all hover:scale-110 hover:ring-1 hover:ring-[var(--ring)] focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                      style={{
                        backgroundColor:
                          decimalUnits(amount) < 0n
                            ? 'var(--success)'
                            : 'var(--spending-deep)',
                        opacity:
                          decimalUnits(amount) === 0n
                            ? 0.1
                            : 0.25 + safePercent(exactAbs(amount), max) * 0.75,
                      }}
                      title={label}
                      aria-label={label}
                      onClick={() => {
                        window.location.hash = activityHref(
                          date,
                          date,
                          report.currency,
                        )
                      }}
                    />
                  )
                })}
              </div>
              <span className="text-foreground/80 text-2xs text-end tabular-nums">
                <PrivacyAmount
                  value={sumMoney(
                    report.daily
                      .filter(
                        (row) =>
                          (new Date(row.date + 'T12:00:00').getDay() + 6) %
                            7 ===
                          index,
                      )
                      .map((row) => row.spending),
                  )}
                  currency={report.currency}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground/70 mt-4 border-t pt-3 text-xs">
        {t('spendingMigration:heatmapLegend')}
      </p>
    </Card>
  )
}
