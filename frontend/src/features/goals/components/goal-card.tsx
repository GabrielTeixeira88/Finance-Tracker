// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 goal-card.tsx; exact money and local routes replace provider contracts.

import { useBalancePrivacy, formatTimeLeft, Link, safePercent } from '../compat'

import type { SourceGoal as Goal } from '../compat'
import { decimalUnits, subtractMoney } from '@/lib/money'
import {
  Badge,
  Card,
  useAmountFormatting,
  type FormattingApi,
  useDateFormatting,
  useNumberFormatting,
} from '@/features/spending/ui'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type TFn = ReturnType<typeof useTranslation>['t']

function defaultQuote(goalType: string, t: TFn): string {
  const quotes: Record<string, string> = {
    car: t('wfGoals:card.quote_car'),
    home: t('wfGoals:card.quote_home'),
    education: t('wfGoals:card.quote_education'),
    retirement: t('wfGoals:card.quote_retirement'),
    wedding: t('wfGoals:card.quote_wedding'),
    custom_save_up: t('wfGoals:card.quote_custom_save_up'),
  }
  return quotes[goalType] ?? ''
}

function formatTargetDate(
  targetDate: string | undefined,
  formatting: Pick<FormattingApi, 'formatCalendarDate'>,
): string | null {
  if (!targetDate) return null
  const value = targetDate.slice(0, 10)
  const formatted = formatting.formatCalendarDate(value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return formatted === '-' ? null : formatted
}

export function ProgressBar({
  progress,
  fillClass,
  unavailable = false,
}: {
  progress: number
  fillClass: string
  unavailable?: boolean
}) {
  const { t } = useTranslation()
  const pct = Math.max(0, Math.min(1, progress))
  return (
    <div
      className="bg-muted/60 relative h-[0.3125rem] w-full overflow-hidden"
      role="progressbar"
      aria-label={t('wfGoals:card.complete')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={unavailable ? undefined : pct * 100}
      aria-valuetext={unavailable ? t('goalsMigration:unavailable') : undefined}
    >
      <div
        className={cn('h-full', fillClass)}
        style={{ width: `${pct * 100}%` }}
      />
      <div className="pointer-events-none absolute inset-0 flex">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="border-card flex-1 border-e last:border-e-0"
          />
        ))}
      </div>
    </div>
  )
}

export function GoalCard({ goal }: { goal: Goal }) {
  const dateFormatting = useDateFormatting()
  const formatting = useAmountFormatting()
  const numberFormatting = useNumberFormatting()
  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()

  const currency = goal.currency
  const current = goal.summaryCurrentValue
  const target = goal.summaryTargetAmount
  const progress = goal.summaryProgress
  const rawQuote =
    goal.description?.trim() || defaultQuote(goal.goalType, t) || ''
  const quote =
    rawQuote.length > 58 ? `${rawQuote.slice(0, 55).trimEnd()}…` : rawQuote

  const isOnTrack = ['on_track', 'achieved'].includes(goal.statusHealth)
  const isAtRisk = goal.statusHealth === 'at_risk'
  const isOffTrack = goal.statusHealth === 'off_track'
  const isAchieved = goal.statusLifecycle === 'achieved'

  // Health drives the accent color:
  //   positive  → success (green)
  //   at risk   → warning (orange)
  //   negative  → destructive (red)
  //   unknown   → neutral (muted) — e.g. "not_applicable" from the backend
  //               (no target set, no projection yet, brand-new goal)
  const isPositive = isOnTrack || isAchieved
  const isNegative = isOffTrack
  const accentClass = isPositive
    ? 'text-success'
    : isAtRisk
      ? 'text-warning'
      : isNegative
        ? 'text-destructive'
        : 'text-muted-foreground'
  const progressBarClass = isPositive
    ? 'bg-success'
    : isAtRisk
      ? 'bg-warning'
      : isNegative
        ? 'bg-destructive'
        : 'bg-muted-foreground/50'

  // Only render the status badge for attention-worthy states.
  let pill: {
    label: string
    variant: 'success-subtle' | 'destructive-subtle' | 'warning-subtle'
  } | null = null
  if (isAchieved) {
    pill = { label: t('goalsMigration:completed'), variant: 'success-subtle' }
  } else if (isOffTrack) {
    pill = { label: t('wfGoals:card.off_track'), variant: 'destructive-subtle' }
  } else if (isAtRisk) {
    pill = { label: t('wfGoals:card.at_risk'), variant: 'warning-subtle' }
  }

  if (goal.statusLifecycle === 'paused')
    pill = { label: t('goalsMigration:paused'), variant: 'warning-subtle' }
  const deadline = goal.targetDate ?? goal.projectedCompletionDate
  const targetDateStr = formatTargetDate(deadline, dateFormatting)
  const timeLeftStr = formatTimeLeft(deadline)

  const remaining =
    current === null
      ? null
      : decimalUnits(target) > decimalUnits(current)
        ? subtractMoney(target, current)
        : '0'
  const hasRemaining =
    remaining !== null &&
    decimalUnits(target) > 0n &&
    decimalUnits(remaining) > 0n

  const currentDisplay = isBalanceHidden
    ? '••••'
    : formatting.formatAmount(current, currency)
  const targetDisplay = isBalanceHidden
    ? '••••'
    : decimalUnits(target) > 0n
      ? formatting.formatAmount(target, currency)
      : '—'
  const remainingDisplay = isBalanceHidden
    ? '••••'
    : hasRemaining
      ? formatting.formatCompactAmount(remaining, currency)
      : '—'

  const progressPct = numberFormatting.formatPercent(progress, { digits: 1 })

  return (
    <Link to={`/goals/${goal.id}`} className="group block">
      <Card className="overflow-hidden p-0 transition-shadow hover:shadow-md">
        {/* Neutral cover: upstream illustrations excluded pending rights clearance. */}
        <div className="bg-secondary/50 relative h-24 overflow-hidden">
          {/* Dark-mode blend: softens bright image bg against the dark card */}
          <div className="pointer-events-none absolute inset-0 hidden bg-black/30 mix-blend-multiply dark:block" />

          {/* Bottom gradient — quote legibility in both themes */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 via-60% to-transparent" />

          {/* Top-left status badge — only for attention-worthy states */}
          {pill && (
            <Badge variant={pill.variant} className="absolute start-3 top-3">
              {pill.label}
            </Badge>
          )}

          {/* Bottom-left italic quote */}
          {quote && (
            <div className="absolute start-3 end-3 bottom-2.5">
              <span className="line-clamp-1 block text-xs text-white/95 italic drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                &ldquo;{quote}&rdquo;
              </span>
            </div>
          )}
        </div>

        {/* Bottom panel */}
        <div className="px-4 pt-3 pb-0">
          {/* Title + % */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base leading-tight font-semibold">
                {goal.title}
              </h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {targetDateStr
                  ? `${targetDateStr} · ${timeLeftStr}`
                  : timeLeftStr}
              </p>
            </div>
            <div className="text-end">
              <div
                className={cn(
                  'text-base font-semibold tabular-nums leading-tight',
                  accentClass,
                )}
              >
                {progressPct}
              </div>
              <div className="text-muted-foreground mt-0.5 text-sm">
                {t('wfGoals:card.complete')}
              </div>
            </div>
          </div>

          {/* Amounts row: saved · remaining */}
          <div className="mt-2.5 flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold tabular-nums">
                {currentDisplay}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {t('wfGoals:card.saved_of')}{' '}
                <span className="tabular-nums">{targetDisplay}</span>
              </div>
            </div>
            <div className="text-end">
              <div className="text-sm font-semibold tabular-nums">
                {remainingDisplay}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {remaining === null
                  ? t('goalsMigration:unavailable')
                  : hasRemaining
                    ? t('wfGoals:card.remaining')
                    : t('wfGoals:card.target_met')}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="-mx-4 mt-2.5">
            <ProgressBar
              progress={
                current === null
                  ? 0
                  : decimalUnits(target) === 0n
                    ? 1
                    : safePercent(current, target)
              }
              unavailable={current === null}
              fillClass={progressBarClass}
            />
          </div>
        </div>
      </Card>
    </Link>
  )
}
