// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 budget-line-chart-card.tsx: original render, rings and controls.
// Finance Tracker adapter supplies exact ledger projections; no manual rollover or income plan.
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import { DashboardCard } from './dashboard-card'
import { cn } from '@/lib/utils'
import { Link, exactAbs, positiveMoney, safePercent } from '../compat'
import {
  PrivacyAmount,
  useAmountFormatting,
  useBalancePrivacy,
  Icons,
} from '../ui'
import { CategoryIcon } from './category-chips'
import type { Category } from '@/lib/api'
import type { BudgetReport } from '@/lib/budget-api'
import { decimalUnits, subtractMoney } from '@/lib/money'
import { budgetCurve } from '@/lib/budget-curve'

export function BudgetLineChartCard({
  data,
  categories,
  onMonth,
}: {
  data: BudgetReport
  categories: Category[]
  onMonth: (delta: number) => void
}) {
  const { t } = useTranslation()
  const amountFormatting = useAmountFormatting()
  const { isBalanceHidden } = useBalancePrivacy()
  const curve = useMemo(() => budgetCurve(data), [data])
  const currency = data.currency,
    monthKey = data.month
  const target = data.summary.available,
    spent = data.summary.expenses
  const isCurrentMonth = data.pace.status === 'current'
  const dayOfMonth = data.pace.elapsed_days,
    daysInMonth = data.pace.days_in_month
  const remaining = positiveMoney(subtractMoney(target, spent)),
    overBy = subtractMoney(spent, target)
  const isOver = decimalUnits(overBy) > 0n
  const forecast = data.pace.projection ?? '0',
    forecastDelta = subtractMoney(forecast, target)
  const forecastReliable =
    isCurrentMonth && data.pace.projection !== null && dayOfMonth >= 7
  const willOverspend = decimalUnits(forecastDelta) > 0n
  const status = isOver
    ? 'overBudget'
    : willOverspend
      ? 'trendingHigh'
      : isCurrentMonth
        ? 'onTrack'
        : 'underBudget'
  const statusLabel = t('wfSpending:budgetChart.' + status)
  const a = {
    accent: isOver
      ? 'var(--destructive)'
      : willOverspend
        ? 'var(--status-warn)'
        : 'var(--success)',
    lineColor: 'var(--spending-deep)',
    pillBg: 'var(--spending-deep)',
  }
  const Icon = isOver || willOverspend ? Icons.AlertCircle : Icons.CheckCircle
  const chartW = 320,
    chartH = 110,
    targetPacePath = '',
    paceX1 = 0,
    paceY1 = 96,
    paceX2 = 320,
    paceY2 = curve.targetY
  const actualPath = curve.path,
    cumulative = curve.points,
    endY = curve.last?.y ?? 96
  const pillLeftPctRaw = ((curve.last?.x ?? 0) / chartW) * 100,
    pillFlip = pillLeftPctRaw > 55
  const pillLeftPct = Math.min(78, Math.max(8, pillLeftPctRaw - 4)),
    pillTopPx = Math.max(0, endY - 28)
  const pillAmount = (value: string) =>
    isBalanceHidden ? '����' : amountFormatting.formatAmount(value, currency)
  const gapLabel = t(
    'wfSpending:budgetChart.' + (isOver ? 'overBudgetAmount' : 'leftAmount'),
    { amount: pillAmount(isOver ? overBy : remaining) },
  )
  const haveHistory = false // Existing backend pace is elapsed-day projection; do not label it historical seasonality.
  const activityRange = {
    from: data.date_from,
    to: data.date_to < data.as_of ? data.date_to : data.as_of,
  }
  const rings = data.categories
    .filter(
      (row) =>
        row.category_id && row.active && decimalUnits(row.available) > 0n,
    )
    .map((row) => ({
      id: row.category_id!,
      categoryId: row.category_id!,
      name: row.name,
      color:
        categories.find((item) => item.id === row.category_id)?.color ?? null,
      icon:
        categories.find((item) => item.id === row.category_id)?.icon ?? null,
      target: row.available,
      spent: row.spent,
      pct: safePercent(row.spent, row.available),
    }))
  const headerAction = (
    <BudgetCardHeaderActions
      monthKey={monthKey}
      monthLabel={monthKey}
      onPreviousMonth={() => onMonth(-1)}
      onNextMonth={() => onMonth(1)}
      canGoNextMonth={monthKey < data.as_of.slice(0, 7)}
    />
  )
  if (decimalUnits(target) <= 0n)
    return (
      <DashboardCard
        title={t('wfSpending:budgetChart.monthlyBudget')}
        action={headerAction}
      >
        <p className="text-muted-foreground text-sm">
          {t('wfSpending:budgetChart.noTarget')}
        </p>
        <BudgetManageLink monthKey={monthKey} />
      </DashboardCard>
    )
  return (
    <DashboardCard
      title={t('wfSpending:budgetChart.monthlyBudget')}
      action={headerAction}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color: a.accent }} />
        <span className="text-foreground text-sm font-semibold">
          {statusLabel}
        </span>
        <span className="text-muted-foreground/70 ms-auto text-xs tabular-nums">
          {isCurrentMonth
            ? t('wfSpending:budgetChart.dayOf', {
                day: dayOfMonth,
                total: daysInMonth,
              })
            : t('wfSpending:budgetChart.closed')}
        </span>
      </div>

      <div className="mt-3">
        {isCurrentMonth &&
        willOverspend &&
        decimalUnits(forecastDelta) * 20n > decimalUnits(target) ? (
          <>
            <div className="text-foreground text-2xl font-bold tracking-tight tabular-nums">
              <PrivacyAmount value={forecast} currency={currency} />{' '}
              <span className="text-muted-foreground/70 text-base font-medium">
                {t('wfSpending:budgetChart.forecastLower')}
              </span>
            </div>
            <div className="text-destructive mt-0.5 inline-flex items-center gap-1 text-xs font-semibold tabular-nums">
              <Icons.ArrowUp className="h-3 w-3" />
              <PrivacyAmount value={forecastDelta} currency={currency} />{' '}
              {t('wfSpending:budgetChart.overBudgetLower')}
            </div>
            <div className="text-muted-foreground/80 mt-0.5 text-xs tabular-nums">
              <PrivacyAmount value={remaining} currency={currency} />{' '}
              {t('wfSpending:budgetChart.leftTodayOf')}{' '}
              <PrivacyAmount value={target} currency={currency} />{' '}
              {t('wfSpending:budgetChart.budgetedThisMonth')}
            </div>
          </>
        ) : !isCurrentMonth ? (
          <>
            <div className="text-foreground text-2xl font-bold tracking-tight tabular-nums">
              <PrivacyAmount value={spent} currency={currency} />{' '}
              <span className="text-muted-foreground/70 text-base font-medium">
                {t('wfSpending:budgetChart.spentLower')}
              </span>
            </div>
            <div
              className={cn(
                'mt-0.5 inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
                isOver ? 'text-destructive' : 'text-success',
              )}
            >
              <PrivacyAmount
                value={isOver ? overBy : remaining}
                currency={currency}
              />{' '}
              {isOver
                ? t('wfSpending:budgetChart.overBudgetLower')
                : t('wfSpending:budgetChart.leftLower')}
            </div>
            <div className="text-muted-foreground/80 mt-0.5 text-xs tabular-nums">
              {t('wfSpending:budgetChart.ofLower')}{' '}
              <PrivacyAmount value={target} currency={currency} />{' '}
              {t('wfSpending:budgetChart.budgetedLower')}
            </div>
          </>
        ) : (
          <>
            <div className="text-foreground text-2xl font-bold tracking-tight tabular-nums">
              <PrivacyAmount
                value={isOver ? overBy : remaining}
                currency={currency}
              />{' '}
              <span className="text-muted-foreground/70 text-base font-medium">
                {isOver
                  ? t('wfSpending:budgetChart.overLower')
                  : t('wfSpending:budgetChart.leftLower')}
              </span>
            </div>
            <div className="text-muted-foreground/80 text-xs tabular-nums">
              {t('wfSpending:budgetChart.ofLower')}{' '}
              <PrivacyAmount value={target} currency={currency} />{' '}
              {t('wfSpending:budgetChart.budgetedThisMonth')}
            </div>
          </>
        )}
      </div>

      <div className="relative mt-4 w-full">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          preserveAspectRatio="none"
          className="block h-27.5 w-full"
        >
          {targetPacePath ? (
            <path
              d={targetPacePath}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeOpacity={0.35}
              strokeDasharray="3 4"
              strokeWidth={1.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <line
              x1={paceX1}
              y1={paceY1}
              x2={paceX2}
              y2={paceY2}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.35}
              strokeDasharray="3 4"
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke={a.lineColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {cumulative.length > 0 && (
          // Rendered as HTML rather than an SVG <circle> so it stays round: the
          // SVG uses preserveAspectRatio="none", which would stretch a circle
          // into an ellipse.
          <div
            className="bg-card absolute h-[0.5625rem] w-[0.5625rem] rounded-full"
            style={{
              left: `${pillLeftPctRaw}%`,
              top: `${endY}px`,
              transform: 'translate(-50%, -50%)',
              border: `2.5px solid ${a.lineColor}`,
            }}
          />
        )}
        {cumulative.length > 0 && (
          <div
            className="text-2xs absolute rounded-full px-2 py-0.5 font-semibold whitespace-nowrap tabular-nums shadow-sm"
            style={{
              left: `${pillFlip ? pillLeftPctRaw : pillLeftPct}%`,
              top: `${pillTopPx}px`,
              transform: pillFlip ? 'translateX(calc(-100% - 6px))' : undefined,
              backgroundColor: a.pillBg,
              color: 'var(--card)',
            }}
          >
            {gapLabel}
          </div>
        )}
      </div>
      <div className="text-muted-foreground/70 text-2xs mt-1 flex justify-between tabular-nums">
        <span>{t('wfSpending:budgetChart.dayN', { day: 1 })}</span>
        <span>{t('wfSpending:budgetChart.dayN', { day: daysInMonth })}</span>
      </div>

      <div className="border-border mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
        <div>
          <div className="text-muted-foreground/70 text-2xs tracking-wide uppercase">
            {isCurrentMonth
              ? t('wfSpending:budgetChart.spentSoFar')
              : t('wfSpending:budgetChart.spentUpper')}
          </div>
          <div className="text-foreground text-sm font-semibold tabular-nums">
            <PrivacyAmount value={spent} currency={currency} />
          </div>
        </div>
        <div className="text-end">
          <div className="text-muted-foreground/70 text-2xs tracking-wide uppercase">
            {isCurrentMonth
              ? t('wfSpending:budgetChart.forecastUpper')
              : t('wfSpending:budgetChart.result')}
          </div>
          {isCurrentMonth ? (
            <div
              className={cn(
                'text-sm font-semibold tabular-nums',
                forecastReliable
                  ? willOverspend
                    ? 'text-destructive'
                    : 'text-foreground'
                  : 'text-muted-foreground/60',
              )}
            >
              {forecastReliable ? (
                <PrivacyAmount value={forecast} currency={currency} />
              ) : (
                '—'
              )}
            </div>
          ) : (
            <div
              className={cn(
                'text-sm font-semibold tabular-nums',
                isOver ? 'text-destructive' : 'text-foreground',
              )}
            >
              <PrivacyAmount
                value={isOver ? overBy : remaining}
                currency={currency}
              />
            </div>
          )}
          <div className="text-muted-foreground/60 text-2xs">
            {isCurrentMonth
              ? forecastReliable
                ? haveHistory
                  ? t('wfSpending:budgetChart.vsLast3Months')
                  : t('wfSpending:budgetChart.atCurrentPace')
                : t('wfSpending:budgetChart.moreDataNeeded')
              : isOver
                ? t('wfSpending:budgetChart.overBudgetLower')
                : t('wfSpending:budgetChart.leftLower')}
          </div>
        </div>
      </div>

      <div className="border-border mt-5 border-t pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-muted-foreground/80 text-2xs font-semibold tracking-wide uppercase">
            {t('wfSpending:budgetChart.byCategory')}
          </span>
          <BudgetManageLink monthKey={monthKey} />
        </div>
        {rings.length === 0 ? (
          <div className="text-muted-foreground py-2 text-center text-xs">
            {t('wfSpending:budgetBars.noBudgets')}{' '}
            <Link
              to="/settings/spending/setup"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              {t('wfSpending:budgetBars.setOne')}
            </Link>
          </div>
        ) : (
          <div
            data-no-swipe-drag
            className="-mx-1 flex min-w-0 touch-pan-x gap-3 !overflow-x-auto overscroll-x-contain px-1 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              maskImage:
                'linear-gradient(to right, black calc(100% - 32px), transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, black calc(100% - 32px), transparent 100%)',
            }}
          >
            {rings.map((r) => (
              <BudgetRing
                key={r.id}
                ring={r}
                currency={currency}
                activityRange={activityRange}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardCard>
  )
}
function BudgetCardHeaderActions({
  monthLabel,
  monthKey,
  onPreviousMonth,
  onNextMonth,
  canGoNextMonth,
}: {
  monthLabel: string
  monthKey: string
  onPreviousMonth: () => void
  onNextMonth: () => void
  canGoNextMonth: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1.5">
      <div className="bg-muted/60 inline-flex items-center rounded-full p-0.5">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="hover:bg-background flex h-6 w-6 items-center justify-center rounded-full transition-colors"
          aria-label={t('wfSpending:budgetChart.previousBudgetMonth')}
        >
          <Icons.ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        </button>
        <span className="text-foreground text-2xs min-w-18.5 px-1 text-center font-medium tabular-nums">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          disabled={!canGoNextMonth}
          className="hover:bg-background disabled:text-muted-foreground/40 flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed"
          aria-label={t('wfSpending:budgetChart.nextBudgetMonth')}
        >
          <Icons.ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </button>
      </div>
      <BudgetManageLink monthKey={monthKey} />
    </div>
  )
}

const BudgetManageLink = ({ monthKey }: { monthKey: string }) => {
  const { t } = useTranslation()
  return (
    <Link
      to={`/spending/budget?month=${monthKey}`}
      className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
    >
      {t('wfSpending:budgetChart.manage')}
    </Link>
  )
}

function BudgetRing({
  ring,
  currency,
  activityRange,
}: {
  ring: {
    categoryId: string
    name: string
    color: string | null
    icon: string | null
    target: string
    spent: string
    pct: number
  }
  currency: string
  activityRange: { from: string; to: string }
}) {
  const formatting = useAmountFormatting()
  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()
  const isOver = decimalUnits(ring.spent) > decimalUnits(ring.target)
  const remaining = subtractMoney(ring.target, ring.spent)
  const ringColor = isOver
    ? 'var(--destructive)'
    : ring.pct > 0.85
      ? 'var(--status-warn)'
      : 'var(--success)'
  const displayAmount = exactAbs(
    isOver ? subtractMoney(ring.spent, ring.target) : remaining,
  )

  const size = 56
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const fillPct = Math.min(1, ring.pct)
  const dash = `${c * fillPct} ${c}`

  return (
    <Link
      to={`/activities?tab=spending&category=${encodeURIComponent(ring.categoryId)}&from=${
        activityRange.from
      }&to=${activityRange.to}`}
      className="hover:bg-muted/40 flex w-16 shrink-0 flex-col items-center gap-1 rounded-md px-1 py-1 transition-colors"
      title={`${ring.name}: ${
        isBalanceHidden
          ? '•••• / ••••'
          : `${formatting.formatAmount(ring.spent, currency)} / ${formatting.formatAmount(ring.target, currency)}`
      }`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeOpacity={0.22}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={dash}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: ring.color ?? ringColor }}
        >
          <CategoryIcon
            icon={ring.icon}
            fallback={ring.name}
            className="h-5 w-5"
          />
        </div>
      </div>
      <div className="text-foreground text-xs font-semibold tabular-nums">
        {isBalanceHidden
          ? '••••'
          : formatting.formatCompactAmount(displayAmount, currency)}
      </div>
      <div
        className={cn(
          'text-2xs uppercase tracking-wide',
          isOver ? 'text-destructive' : 'text-muted-foreground/70',
        )}
      >
        {isOver
          ? t('wfSpending:budgetChart.overLower')
          : t('wfSpending:budgetChart.leftLower')}
      </div>
    </Link>
  )
}
