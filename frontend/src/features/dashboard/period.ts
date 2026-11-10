// Dashboard filters live in the URL, never localStorage. Calendar dates are local.
import { netWorthStart } from '@/lib/net-worth-period'
import { spendingPeriod, validDay } from '@/lib/spending-period'
import { navigateTo } from '@/lib/navigation'

export function dashboardDates(
  page: string,
  params: URLSearchParams,
  asOf: string,
) {
  const end = params.get('end') || params.get('as_of') || asOf
  const explicit = params.get('start')
  if (
    explicit &&
    validDay(explicit) &&
    validDay(end) &&
    explicit < end &&
    end <= asOf
  )
    return { start: explicit, end, range: params.get('range') || 'Custom' }
  if (page === 'Budget')
    return { ...spendingPeriod('MTD', asOf), range: 'Custom' }
  const range = params.get('range') || (page === 'Net Worth' ? '1Y' : '3M')
  return { start: netWorthStart(range, end, explicit || end), end, range }
}

/** Only period keys cross tabs. Investment scopes must never filter household wealth. */
export function dashboardTabParams(
  page: string,
  params: URLSearchParams,
  asOf: string,
) {
  const period = dashboardDates(page, params, asOf)
  return { ...period }
}

export function dashboardDetailContext(
  page: 'investments' | 'net-worth',
  period: { start: string; end: string; range: string },
  account = '',
) {
  return {
    ...period,
    from_dashboard: page,
    dashboard_start: period.start,
    dashboard_end: period.end,
    dashboard_range: period.range,
    dashboard_account: account || 'ALL',
  }
}

/** Detail controls own their dates; Back restores the caller's separate URL snapshot. */
export function backToDashboard(
  params: URLSearchParams,
  fallbackAccount?: string,
) {
  const source = params.get('from_dashboard')
  if (source !== 'investments' && source !== 'net-worth') return false
  const account = params.has('dashboard_account')
    ? params.get('dashboard_account') === 'ALL'
      ? undefined
      : params.get('dashboard_account') || undefined
    : fallbackAccount
  navigateTo(
    source === 'investments' ? 'Investments' : 'Net Worth',
    source === 'investments' ? account : undefined,
    {
      view: 'Overview',
      start: params.get('dashboard_start') || params.get('start') || '',
      end: params.get('dashboard_end') || params.get('end') || '',
      range: params.get('dashboard_range') || params.get('range') || '3M',
    },
  )
  return true
}
