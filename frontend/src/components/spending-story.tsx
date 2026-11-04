import type { BudgetReport, BudgetRow } from '@/lib/budget-api'
import { t } from '@/lib/i18n'
import { formatMoney, activityPercent } from '@/lib/money'
import { getLocale } from '@/lib/preferences'
import { Money, SectionHeader } from './primitives'

export function SpendingStory({
  data,
  onCategory,
}: {
  data: BudgetReport
  onCategory: (row: BudgetRow) => void
}) {
  const n = data.narrative
  if (!n || !data.pace.elapsed_days) return null
  const fmt = (v: string) => formatMoney(v, data.currency)
  return (
    <section className="spending-story">
      <SectionHeader title={t('parity:spending_narrative')} />
      <p className="story-lead">
        {t('parity:period_spending', {
          amount: fmt(data.summary.expenses),
          days: data.pace.elapsed_days,
        })}
      </p>
      <p>
        {t('parity:period_flow', {
          income: fmt(data.summary.income),
          net: fmt(data.summary.net_flow),
        })}
      </p>
      <div className="story-context">
        <strong>{t(`parity:${n.budget_status}`)}</strong>
        <span>{t('parity:remaining_days', { count: n.remaining_days })}</span>
      </div>
      {n.recent_daily !== null && (
        <p>{t('parity:recent_pace', { amount: fmt(n.recent_daily) })}</p>
      )}
      {data.pace.projection !== null && (
        <p className="workflow-context">
          {t('parity:projected_spending', {
            amount: fmt(data.pace.projection),
          })}
        </p>
      )}
      <div className="spending-story-changes">
        {n.changes.map((c) => (
          <button
            key={c.category_id ?? 'none'}
            onClick={() =>
              onCategory(
                data.categories.find((r) => r.category_id === c.category_id)!,
              )
            }
          >
            {t(`parity:${c.kind}`, {
              category: c.name,
              amount: fmt(c.kind === 'quiet_category' ? c.previous : c.change),
            })}
          </button>
        ))}
      </div>
      <details>
        <summary>{t('parity:weekday_spending')}</summary>
        <div className="weekday-bars">
          {n.weekdays.map((d) => {
            const label = new Intl.DateTimeFormat(getLocale(), {
              weekday: 'short',
              timeZone: 'UTC',
            }).format(new Date(Date.UTC(2026, 0, 5 + d.weekday)))
            return (
              <div key={d.weekday}>
                <span>{label}</span>
                <progress
                  max={100}
                  value={activityPercent(d.value, data.summary.expenses, '0')}
                  aria-label={label}
                />
                <Money value={d.value} currency={data.currency} />
              </div>
            )
          })}
        </div>
      </details>
    </section>
  )
}
