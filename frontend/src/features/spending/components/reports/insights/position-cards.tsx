// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 where-i-am-stage.tsx: source card JSX; exact existing period and monthly pace adapter.
import { useTranslation } from 'react-i18next'
import type { Category } from '@/lib/api'
import type { BudgetReport } from '@/lib/budget-api'
import {
  formatExactPercent,
  formatRatioPercent,
  decimalUnits,
  unitsToMoney,
  subtractMoney,
} from '@/lib/money'
import type { SpendingWorkspaceData } from '../../../api'
import {
  useBalancePrivacy,
  Link,
  safePercent,
  exactAbs,
  exactRatio,
} from '../../../compat'
import { PrivacyAmount, useAmountFormatting, badgeVariants } from '../../../ui'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'
import { dayAfter } from '@/lib/spending-period'
import { cn } from '@/lib/utils'
const CARD_CLASS =
  'bg-linear-to-br from-white/[0.07] via-transparent to-black/[0.04] p-5 dark:from-white/[0.025] dark:to-black/[0.06]'
const LABEL_CLASS =
  'text-muted-foreground/70 text-2xs font-semibold uppercase tracking-[0.12em]'
export function PaceCard({ data }: { data: BudgetReport }) {
  const { t } = useTranslation()
  const currency = data.currency,
    target = data.summary.available,
    spent = data.summary.expenses
  const diff = subtractMoney(spent, target),
    over = decimalUnits(diff) > 0n
  const projected =
    data.pace.status === 'current' && data.pace.elapsed_days >= 7
      ? data.pace.projection
      : null
  const forecastOver =
    projected !== null && decimalUnits(projected) > decimalUnits(target)
  const status = over ? 'over' : forecastOver ? 'approach' : 'ok',
    statusColor = over
      ? 'var(--destructive)'
      : forecastOver
        ? 'var(--status-warn)'
        : 'var(--success)'
  const statusLabel = t(
    'wfSpending:whereIAm.' +
      (over
        ? 'statusOverBudget'
        : forecastOver
          ? 'statusTrendingHigh'
          : 'statusOnTrack'),
  )
  const pace = {
    status,
    contextRight: data.month,
    percentSpent: safePercent(spent, target),
    percentPace: data.pace.elapsed_days / data.pace.days_in_month,
    narrative: (
      <div className="flex flex-col gap-1.5">
        <div
          className={cn(
            'text-xl font-semibold tabular-nums tracking-tight md:text-2xl',
            over ? 'text-destructive' : 'text-success',
          )}
        >
          {t('wfSpending:whereIAm.' + (over ? 'overBy' : 'underBy'))}{' '}
          <PrivacyAmount value={exactAbs(diff)} currency={currency} />
        </div>
        <div className="text-foreground/90 text-sm">
          <PrivacyAmount value={target} currency={currency} /> ·{' '}
          {t('spendingMigration:available')}
        </div>
        {projected !== null && (
          <div className="text-muted-foreground/80 text-xs">
            {t('wfSpending:whereIAm.projectedPrefix')}{' '}
            <PrivacyAmount value={projected} currency={currency} />
          </div>
        )}
      </div>
    ),
  }
  if (decimalUnits(target) <= 0n)
    return (
      <Card className={CARD_CLASS}>
        <p className={LABEL_CLASS}>{t('wfSpending:whereIAm.noBudgetSet')}</p>
        <Link
          to={'/spending/budget?month=' + data.month}
          className="mt-4 inline-block text-sm hover:underline"
        >
          {t('wfSpending:whereIAm.createBudget')}
        </Link>
      </Card>
    )

  return (
    <Card className={CARD_CLASS}>
      {/* Row 1 — label + context (matches the other two cards' top row) */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="inline-flex items-center gap-1.5">
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          <span className={LABEL_CLASS} style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>
        <span className="text-muted-foreground/70 text-2xs">
          {pace.contextRight}
        </span>
      </div>

      {/* Row 2 — text insight (replaces the redundant "big number" — that fact
          already lives in the Spent card next to it). Serif for editorial feel. */}
      <div className="mt-3">{pace.narrative}</div>

      {/* Row 3 — progress bar with pace tick */}
      <div className="bg-foreground/10 relative mt-4 h-2 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, pace.percentSpent * 100)}%`,
            backgroundColor: statusColor,
            opacity: 0.7,
          }}
        />
        <div
          className="bg-foreground/70 absolute inset-y-0 w-px"
          style={{
            insetInlineStart: `${Math.min(100, pace.percentPace * 100)}%`,
          }}
          aria-hidden
          title={t('wfSpending:whereIAm.paceTitle', {
            pct: String(Math.round(pace.percentPace * 100)),
          })}
        />
      </div>
    </Card>
  )
}
export function SpentThisPeriodCard({
  report,
  categories,
}: {
  report: SpendingWorkspaceData
  categories: Category[]
}) {
  const { t } = useTranslation(),
    { isBalanceHidden } = useBalancePrivacy(),
    formatting = useAmountFormatting()
  const currency = report.currency,
    spent = report.current.expenses
  const periodLabel = t('wfSpending:whereIAm.spentThisPeriod')
  const deltaPct = report.current.change_percent
  const priorLabel =
    report.previous_start + ' — ' + dayAfter(report.previous_end_exclusive, -1)
  const negative = report.categories.some(
    (row) => decimalUnits(row.current) < 0n,
  )
  const segments = negative
    ? []
    : report.categories
        .filter((row) => decimalUnits(row.current) > 0n)
        .map((row) => ({
          id: row.category_id ?? 'none',
          name: row.name,
          amount: row.current,
          color:
            categories.find((c) => c.id === row.category_id)?.color ??
            'var(--spending-deep)',
          share: safePercent(row.current, spent) * 100,
          percent: unitsToMoney(
            (decimalUnits(row.current) * 100000000n) /
              (decimalUnits(spent) || 1n),
          ),
        }))

  return (
    <Card className={CARD_CLASS}>
      <div className={LABEL_CLASS}>{periodLabel}</div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-foreground text-lg font-semibold tracking-tight tabular-nums md:text-xl">
          <PrivacyAmount value={spent} currency={currency} />
        </div>
        {deltaPct != null && (
          <span
            className={cn(
              badgeVariants({
                variant:
                  decimalUnits(exactAbs(deltaPct)) < 1000000n
                    ? 'secondary'
                    : decimalUnits(deltaPct) > 0n
                      ? 'warning-subtle'
                      : 'success-subtle',
              }),
              'text-2xs tabular-nums',
              decimalUnits(exactAbs(deltaPct)) < 1000000n &&
                'bg-muted/50 text-muted-foreground',
            )}
          >
            {formatExactPercent(deltaPct)} {priorLabel}
          </span>
        )}
      </div>

      {/* Segmented stacked bar */}
      {segments.length > 0 ? (
        <>
          <div className="bg-foreground/5 mt-4 flex h-2 w-full overflow-hidden rounded-full">
            {segments.map((s, i) => (
              <div
                key={s.id}
                className="h-full"
                style={{
                  width: `${s.share}%`,
                  backgroundColor: s.color,
                  borderRight:
                    i < segments.length - 1
                      ? '1px solid var(--card)'
                      : undefined,
                }}
                title={`${s.name} · ${
                  isBalanceHidden
                    ? '••••'
                    : formatting.formatAmount(s.amount, currency)
                } (${formatExactPercent(s.percent)})`}
              />
            ))}
          </div>
          <div className="text-2xs mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {segments.slice(0, 4).map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span
                  className="block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-foreground/80">{s.name}</span>
                <span className="text-muted-foreground/70 tabular-nums">
                  {formatExactPercent(s.percent)}
                </span>
              </span>
            ))}
            {segments.length > 4 && (
              <span className="text-muted-foreground/70 text-2xs inline-flex items-center">
                {t('wfSpending:whereIAm.moreCount', {
                  count: segments.length - 4,
                })}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="text-muted-foreground/70 mt-4 text-xs">
          {t('wfSpending:hierarchy.noCategorizedSpending')}
        </div>
      )}
    </Card>
  )
}
export function NetCashflowCard({ report }: { report: SpendingWorkspaceData }) {
  const { t } = useTranslation(),
    currency = report.currency
  const totals = {
    income: report.current.income,
    spent: report.current.expenses,
    saved: report.current.net_saved,
    net: report.current.after_savings,
  }
  const denom = [totals.income, totals.spent, totals.saved].reduce(
    (max, value) => (decimalUnits(value) > decimalUnits(max) ? value : max),
    '0',
  )
  const incomePct = safePercent(totals.income, denom) * 100,
    spentPct = safePercent(totals.spent, denom) * 100,
    savedPct = safePercent(totals.saved, denom) * 100
  const netToneClass =
    decimalUnits(totals.net) >= 0n ? 'text-success' : 'text-destructive'

  return (
    <Card className={CARD_CLASS}>
      <div className="flex items-baseline justify-between">
        <div className={LABEL_CLASS}>
          {t('wfSpending:whereIAm.netCashflow')}
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div
          className={cn(
            'text-lg font-semibold tabular-nums tracking-tight md:text-xl',
            netToneClass,
          )}
        >
          {decimalUnits(totals.net) >= 0n ? '+' : '−'}
          <PrivacyAmount value={exactAbs(totals.net)} currency={currency} />
        </div>
        {decimalUnits(totals.income) > 0n && (
          <span
            className={cn(
              badgeVariants({
                variant:
                  decimalUnits(totals.net) >= 0n
                    ? 'success-subtle'
                    : 'destructive-subtle',
              }),
              'text-2xs tabular-nums',
            )}
          >
            {formatRatioPercent(exactRatio(totals.net, totals.income), 2, true)}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-2xs flex items-center gap-2">
          <span className="text-muted-foreground w-16 shrink-0">
            {t('wfSpending:cashFlow.income')}
          </span>
          <div className="bg-foreground/5 h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-success/65 h-full rounded-full transition-all"
              style={{ width: `${incomePct}%` }}
            />
          </div>
          <span className="text-foreground/90 w-20 shrink-0 text-end font-semibold tabular-nums">
            <PrivacyAmount value={totals.income} currency={currency} />
          </span>
        </div>
        {decimalUnits(totals.income) === 0n && (
          <p className="text-muted-foreground/70 text-2xs ps-14 leading-snug">
            {t('wfSpending:whereIAm.noIncome')}
          </p>
        )}
        <div className="text-2xs flex items-center gap-2">
          <span className="text-muted-foreground w-16 shrink-0">
            {t('wfSpending:whereIAm.spent')}
          </span>
          <div className="bg-foreground/5 h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-foreground/60 h-full rounded-full transition-all"
              style={{ width: `${spentPct}%` }}
            />
          </div>
          <span className="text-foreground/90 w-20 shrink-0 text-end font-semibold tabular-nums">
            <PrivacyAmount value={totals.spent} currency={currency} />
          </span>
        </div>
        {decimalUnits(totals.saved) > 0n && (
          <div className="text-2xs flex items-center gap-2">
            <span className="text-muted-foreground w-16 shrink-0">
              {t('wfSpending:cashFlow.netSaved')}
            </span>
            <div className="bg-foreground/5 h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-success/70 transition-all"
                style={{ width: `${savedPct}%` }}
              />
            </div>
            <span className="text-foreground/90 w-20 shrink-0 text-end font-semibold tabular-nums">
              <PrivacyAmount value={totals.saved} currency={currency} />
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}
