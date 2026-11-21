import type { TFunction } from 'i18next'
import type { GoalDetail } from '@/lib/wealth-api'
import { formatDate, formatExactPercent, decimalUnits } from '@/lib/money'
import type { SavingsMilestone } from '../save-up/components/savings-milestones-card'
export type ProjectionPoint = {
  date: string
  nominal: string | null
  target: string | null
  actual: string | null
}
export function sourceProjection(detail: GoalDetail) {
  return {
    currentValue: detail.saved,
    projectedValueAtTargetDate: detail.trajectory?.projected_end ?? null,
    requiredMonthlyContribution: detail.required_monthly,
    projectedCompletionDate: detail.projected_completion,
    health: detail.trajectory?.status.toLowerCase() ?? 'unavailable',
    trajectory: (detail.trajectory?.points ?? []).map((point) => ({
      date: point.date,
      nominal: point.projected,
      target: point.required,
      actual: point.actual,
    })),
  }
}
export function buildSavingsMilestones(
  detail: GoalDetail,
  t: TFunction,
): SavingsMilestone[] {
  return detail.milestone_details.map((row) => ({
    ratio: row.percent / 100,
    label: formatExactPercent(String(row.percent)),
    amount: row.amount,
    reached: row.reached,
    isFinal: row.percent === 100,
    dateLabel: row.reached
      ? row.first_observed_date
        ? t('goalsMigration:observed', {
            date: formatDate(row.first_observed_date),
          })
        : t('goalsMigration:unknownTiming')
      : row.estimated_date
        ? t('goalsMigration:estimated', {
            date: formatDate(row.estimated_date),
          })
        : t('goalsMigration:noEstimate'),
  }))
}
export function saveUpStatus(
  {
    title,
    saved,
    target,
    deadline,
    dateLabel,
    health,
    lifecycle,
  }: {
    title: string
    saved: string | null
    target: string
    deadline: string
    dateLabel: string | null
    health: string
    lifecycle: string
  },
  t: TFunction,
) {
  const unavailable = saved === null,
    paused = lifecycle === 'PAUSED',
    archived = lifecycle === 'ARCHIVED'
  const key = unavailable
    ? 'unavailable'
    : paused
      ? 'paused'
      : archived
        ? 'archived'
        : decimalUnits(saved) >= decimalUnits(target)
          ? 'reached'
          : !deadline
            ? 'setup'
            : health === 'on_track'
              ? 'on_track'
              : health === 'at_risk'
                ? 'at_risk'
                : 'off_track'
  const tone =
    key === 'reached' || key === 'on_track'
      ? 'success'
      : key === 'at_risk'
        ? 'warning'
        : key === 'off_track'
          ? 'destructive'
          : 'muted'
  const neutral = ['unavailable', 'paused', 'archived'].includes(key)
  const colors = {
    success: {
      badge: 'bg-success text-success-foreground',
      text: 'text-success',
      progress: 'bg-success',
    },
    warning: {
      badge: 'bg-warning-subtle text-warning-subtle-foreground',
      text: 'text-warning',
      progress: 'bg-warning',
    },
    destructive: {
      badge: 'bg-destructive-subtle text-destructive-subtle-foreground',
      text: 'text-destructive',
      progress: 'bg-destructive',
    },
    muted: {
      badge: 'bg-muted text-muted-foreground',
      text: 'text-muted-foreground',
      progress: 'bg-muted-foreground/40',
    },
  }[tone]
  return {
    label: neutral
      ? t(
          key === 'unavailable'
            ? 'goalsMigration:unavailable'
            : key === 'paused'
              ? 'goalsMigration:paused'
              : 'wfGoals:edit.lifecycle_archived_label',
        )
      : t('wfGoals:save_up.status_' + (key === 'setup' ? 'setup_needed' : key)),
    headlinePrefix: neutral
      ? title
      : t('wfGoals:save_up.headline_' + key + '_prefix', { title }),
    headlineEmphasis: neutral
      ? ''
      : t('wfGoals:save_up.headline_' + key + '_emphasis'),
    headlineSuffix: neutral
      ? ''
      : t('wfGoals:save_up.headline_' + key + '_suffix', {
          title,
          date: dateLabel ?? t('wfGoals:save_up.your_target_date'),
        }),
    badgeClass: colors.badge,
    textClass: colors.text,
    progressClass: colors.progress,
  }
}
