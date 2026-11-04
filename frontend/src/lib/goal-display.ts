import { formatRatioPercent } from './money'
import { t } from './i18n'

// Compatibility for existing, edited demo workspaces; never rename personal data.
const demoTitles = new Set([
  'Emergency fund',
  'International vacation',
  'Vehicle upgrade',
  'Design course',
  'Home studio',
])
export function goalTitle(name: string, demo: boolean): string {
  const plain = name.startsWith('Synthetic / ')
    ? name.slice('Synthetic / '.length)
    : name
  return demo && demoTitles.has(plain) ? plain : name
}

export const goalPercent = (ratio: string | null) =>
  formatRatioPercent(ratio, 1, true)

// Calendar arithmetic follows the reference; use days instead of "0 months".
export function goalTimeLeft(deadline: string | null, asOf: string): string {
  if (!deadline) return t('dynamic:no_deadline_c4a597')
  const parse = (day: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
    const result = new Date(`${day}T12:00:00Z`)
    return Number.isFinite(result.getTime()) &&
      result.toISOString().slice(0, 10) === day
      ? result
      : null
  }
  const end = parse(deadline),
    now = parse(asOf)
  if (!end || !now) return t('common:unavailable')
  const days = Math.round((end.getTime() - now.getTime()) / 86400000)
  if (days < 0) return t('goal_progress:days_overdue', { count: -days })
  if (days === 0) return t('goal_progress:due_today')
  let months =
    (end.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    now.getUTCMonth()
  if (end.getUTCDate() < now.getUTCDate()) months--
  if (months < 1) return t('goal_progress:days_left', { count: days })
  const years = Math.floor(months / 12),
    rest = months % 12
  return years
    ? rest
      ? t('goal_progress:years_months_left', { years, months: rest })
      : t('goal_progress:years_left', { count: years })
    : t('goal_progress:months_left', { count: months })
}
