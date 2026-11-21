/* eslint-disable react-refresh/only-export-components -- Local source adapter boundary. */
import './i18n'
import type { AnchorHTMLAttributes } from 'react'
import type { GoalDetail } from '@/lib/wealth-api'
import { getDemoDate } from '@/lib/api'
import { goalTitle, goalTimeLeft } from '@/lib/goal-display'
import { goalDate } from './api'
export { useBalancePrivacy } from '../holdings/compat'
export * from '../holdings/number-formatters'
export { safePercent, exactAbs, exactRatio } from '../spending/compat'
export const goalHref = (id: string) => '#/goals?goal=' + encodeURIComponent(id)
export function Link({
  to,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      {...props}
      href={
        to === '/goals/new'
          ? '#/goals?new=true'
          : to === '/goals'
            ? '#/goals'
            : goalHref(to.replace('/goals/', ''))
      }
    />
  )
}
export const formatTimeLeft = (deadline?: string) =>
  goalTimeLeft(deadline ?? null, goalDate())
export type SourceGoal = ReturnType<typeof sourceGoal>
export function sourceGoal(detail: GoalDetail) {
  const lifecycle =
    detail.goal.status === 'ARCHIVED'
      ? 'archived'
      : detail.goal.status === 'PAUSED'
        ? 'paused'
        : detail.goal.status === 'COMPLETED'
          ? 'achieved'
          : 'active'
  return {
    id: detail.goal.id,
    title: goalTitle(detail.goal.name, Boolean(getDemoDate())),
    description: detail.goal.notes,
    goalType: detail.plan.goal_type,
    currency: detail.goal.currency,
    targetAmount: detail.goal.target,
    targetDate: detail.goal.deadline ?? undefined,
    summaryCurrentValue: detail.saved,
    summaryTargetAmount: detail.goal.target,
    summaryProgress: detail.progress,
    statusHealth: (
      detail.trajectory?.status ??
      detail.schedule_pace?.status ??
      'UNAVAILABLE'
    ).toLowerCase(),
    statusLifecycle: lifecycle,
    createdAt: detail.goal.start_date,
    projectedCompletionDate: detail.projected_completion ?? undefined,
    coverImageKey: detail.plan.goal_type,
  }
}
