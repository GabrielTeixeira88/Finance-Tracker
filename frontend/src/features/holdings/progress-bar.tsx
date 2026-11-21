// Adapted from Wealthfolio 92b4647 goal-card.tsx ProgressBar (AGPL-3.0-only).
import { activityPercent } from '@/lib/money'
import { cn } from '@/lib/utils'
export function ProgressBar({
  progress,
  fillClass,
}: {
  progress: string
  fillClass: string
}) {
  return (
    <div className="bg-muted/60 relative h-[0.3125rem] w-full overflow-hidden">
      <div
        className={cn('h-full', fillClass)}
        style={{ width: `${activityPercent(progress, '1', '0')}%` }}
      />
    </div>
  )
}
