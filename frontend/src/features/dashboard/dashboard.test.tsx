import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccountsSummary } from './summary-sections'
import { FinancialPrivacy } from '@/components/financial-privacy'
import { Balance } from './balance'
import { MomentumCard } from './momentum-card'
import {
  dashboardDates,
  dashboardTabParams,
  dashboardDetailContext,
  backToDashboard,
} from './period'
import { readRoute } from '@/lib/navigation'
import { historyGeometry } from './history-geometry'
import { syntheticReport } from '@/test/fixtures/synthetic/net-worth'
import { setPreferences, defaults } from '@/lib/preferences'

describe('dashboard periods', () => {
  it('restores the original dashboard dates and all-account scope after detail filters change', () => {
    const context = dashboardDetailContext('investments', {
      start: '2026-06-30',
      end: '2026-09-30',
      range: '3M',
    })
    const params = new URLSearchParams({
      ...context,
      range: '1M',
      start: '2026-08-30',
      account: 'detail-account',
    })
    expect(backToDashboard(params, 'detail-account')).toBe(true)
    expect(readRoute().page).toBe('Investments')
    expect(readRoute().accountId).toBeUndefined()
    expect(readRoute().params.get('start')).toBe('2026-06-30')
    expect(readRoute().params.get('range')).toBe('3M')
    params.set('from_dashboard', 'net-worth')
    params.set('dashboard_account', 'must-not-scope-household')
    backToDashboard(params)
    expect(readRoute().page).toBe('Net Worth')
    expect(readRoute().accountId).toBeUndefined()
  })
  it('shares only period keys, preserving an exact custom window without account scope', () => {
    const params = new URLSearchParams(
      'start=2026-08-01&end=2026-08-31&account=broker&asset=security&range=Custom',
    )
    expect(dashboardTabParams('Investments', params, '2026-09-30')).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
      range: 'Custom',
    })
    expect(
      dashboardDates('Budget', new URLSearchParams(), '2026-09-30'),
    ).toEqual({ start: '2026-09-01', end: '2026-09-30', range: 'Custom' })
  })
  it('uses calendar-clamped periods and keeps the underlying observations unchanged', () => {
    expect(
      dashboardDates(
        'Investments',
        new URLSearchParams('range=1M'),
        '2026-03-31',
      ).start,
    ).toBe('2026-02-28')
    const points = [
      {
        date: '2025-01-01',
        value: '9007199254740993.123456',
        net_contribution: '100',
      },
      { date: '2025-01-02', value: null, net_contribution: null },
      {
        date: '2025-01-03',
        value: '-9007199254740993.123456',
        net_contribution: '100',
      },
    ]
    const original = JSON.stringify(points),
      result = historyGeometry(points)
    expect(result[0].value).toBe(points[0].value)
    expect(result[0].totalValue).toBeGreaterThan(0)
    expect(result[1].totalValue).toBeNull()
    expect(result[2].totalValue).toBeLessThan(0)
    expect(JSON.stringify(points)).toBe(original)
    expect(
      historyGeometry([
        { date: '2025-01-01', value: '0', net_contribution: '0' },
      ])[0].totalValue,
    ).toBe(0)
  })
})
it('shows exact selected-date account values and navigates without masking unavailable returns as zero', async () => {
  setPreferences({ ...defaults, language: 'en' })
  const open = vi.fn()
  render(
    <AccountsSummary
      currency="BRL"
      onOpen={open}
      rows={[
        {
          id: 'fictional',
          name: 'Fictional broker',
          currency: 'BRL',
          active: false,
          value: '12345.678901',
          gain: {
            value: '100.123456',
            quality: 'COMPLETE',
            method: '',
            reasons: [],
          },
          twr: {
            value: null,
            quality: 'UNAVAILABLE',
            method: '',
            reasons: ['MISSING_HISTORY'],
          },
        },
      ]}
    />,
  )
  expect(screen.getByText('R$ 12.345,68')).toBeVisible()
  expect(screen.getByText('Unavailable')).toBeVisible()
  await userEvent.click(
    screen.getByRole('button', { name: /Fictional broker/ }),
  )
  expect(open).toHaveBeenCalledWith('fictional')
})
it('shares privacy across nested dashboard readers and masks exact amounts and Momentum titles', async () => {
  setPreferences({ ...defaults, language: 'en' })
  const report = syntheticReport()
  report.insights = {
    tracked_since: '2024-01-01',
    velocity: {
      available: false,
      reasons: [],
      per_month: null,
      change: null,
      drivers: [],
    },
    categories: [],
    stale: [],
    unlinked_mortgages: [],
    momentum: {
      current_change: '500',
      prior_change: '100',
      beat_by: '400',
      prior_start: '2024-12-02',
      bars: [
        { month: '2024-12', value: '100', current: false },
        { month: '2025-01', value: '500', current: true },
      ],
      method: 'Exact fictional endpoints',
    },
  }
  const { container } = render(
    <FinancialPrivacy>
      <Balance value="8000" currency="BRL" />
      <FinancialPrivacy>
        <MomentumCard report={report} period="1M" />
      </FinancialPrivacy>
    </FinancialPrivacy>,
  )
  expect(screen.getByText('Momentum')).toBeVisible()
  expect(container.querySelector('[title*="500,00"]')).not.toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Hide balances' }))
  expect(container.querySelector('[title*="500,00"]')).toBeNull()
  expect(container).not.toHaveTextContent('8.000,00')
})
