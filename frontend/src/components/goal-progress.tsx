// Card hierarchy and segmented progress adapted from Wealthfolio goal-card.tsx,
// d86c201, AGPL-3.0-only. See THIRD_PARTY_NOTICES.md. No cover images are used.
import { t as tr, ui } from '@/lib/i18n'
import { decimalUnits, formatDate } from '@/lib/money'
import { localDate } from '@/lib/api'
import { goalTitle, goalPercent, goalTimeLeft } from '@/lib/goal-display'
import { useDemoRuntime } from '@/lib/demo-runtime'
import type { GoalDetail } from '@/lib/wealth-api'
import { Money } from './primitives'

export function GoalProgress({
  data,
  onOpen,
}: {
  data: GoalDetail
  onOpen: () => void
}) {
  const { runtime } = useDemoRuntime()
  const name = goalTitle(data.goal.name, !!runtime)
  const ratio = data.progress === null ? null : decimalUnits(data.progress)
  // Only a bounded, dimensionless progress coordinate becomes a Number.
  const coordinate =
    ratio === null
      ? 0
      : Number(ratio < 0n ? 0n : ratio > 1_000_000n ? 10000n : ratio / 100n) /
        100
  const percent = goalPercent(data.progress)
  const pace =
    data.schedule_pace?.status ?? (data.overdue ? 'OFF_TRACK' : 'UNAVAILABLE')
  const behind = pace === 'OFF_TRACK' || pace === 'AT_RISK'
  const positive = pace === 'ON_TRACK' || pace === 'ACHIEVED'
  const asOf = data.as_of ?? runtime?.end_date ?? localDate()
  const timeLeft = goalTimeLeft(data.goal.deadline, asOf)
  return (
    <button className="goal-visual" onClick={onOpen} aria-label={name}>
      <span className="goal-card-body">
        <span className="goal-card-heading">
          <span className="goal-card-identity">
            <strong>{name}</strong>
            <span className="goal-card-deadline">
              {data.goal.deadline
                ? formatDate(data.goal.deadline)
                : tr('dynamic:no_deadline_c4a597')}
              {data.goal.deadline && (
                <>
                  {' '}
                  {'\u00b7'} {timeLeft}
                </>
              )}
            </span>
          </span>
          <span
            className={`goal-card-completion${behind ? ' negative' : positive ? ' is-positive' : ''}`}
            title={tr('goal_progress:pace_basis')}
          >
            <span>{percent}</span>
            <span className="goal-card-label">
              {tr('goal_progress:complete')}
            </span>
          </span>
        </span>
        {(behind || data.goal.status !== 'ACTIVE') && (
          <span className={`goal-card-state${behind ? ' negative' : ''}`}>
            {behind
              ? tr(
                  data.overdue
                    ? 'goal_progress:overdue'
                    : pace === 'AT_RISK'
                      ? 'goal_progress:at_risk'
                      : 'goal_progress:off_track',
                )
              : ui(data.goal.status)}
          </span>
        )}
        <span className="goal-card-amounts">
          <span>
            {data.saved === null ? (
              <span>{tr('common:unavailable')}</span>
            ) : (
              <Money
                value={data.saved}
                currency={data.goal.currency}
                fractionDigits={2}
              />
            )}
            <span className="goal-card-label">
              {tr('goal_progress:saved_of')}{' '}
              <Money
                value={data.goal.target}
                currency={data.goal.currency}
                fractionDigits={2}
              />
            </span>
          </span>
          <span className="goal-card-remaining">
            {data.remaining === null ? (
              <span>{tr('common:unavailable')}</span>
            ) : (
              <Money
                value={data.remaining}
                currency={data.goal.currency}
                fractionDigits={2}
              />
            )}
            <span className="goal-card-label">
              {tr('goal_progress:remaining')}
            </span>
          </span>
        </span>
      </span>
      <span
        className="goal-card-track"
        role="img"
        aria-label={`${name}: ${percent}`}
      >
        <span
          className={`goal-card-fill${behind ? ' is-overdue' : positive ? ' is-positive' : ''}`}
          style={{ width: `${coordinate}%` }}
        />
        <span className="goal-card-segments" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} />
          ))}
        </span>
      </span>
    </button>
  )
}
