import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { NetWorthOverview } from './net-worth-overview'
import { FinancialPrivacy } from './financial-privacy'
import { syntheticReport } from '@/test/fixtures/synthetic/net-worth'
import { defaults, setPreferences } from '@/lib/preferences'

vi.mock('./net-worth-chart', () => ({
  NetWorthChart: ({ label }: { label: string }) => (
    <figure aria-label={label} />
  ),
}))

it('masks monetary labels and exact titles, and restores them without altering report data', async () => {
  setPreferences({ ...defaults, language: 'en' })
  const report = syntheticReport(),
    original = JSON.stringify(report)
  const { container } = render(
    <FinancialPrivacy>
      <NetWorthOverview
        report={report}
        positions={[]}
        period="1M"
        setPeriod={vi.fn()}
        chartSeries="value"
        seriesControl={null}
        methods={null}
        onComponent={vi.fn()}
        onPosition={vi.fn()}
      />
    </FinancialPrivacy>,
  )
  expect(container.querySelector('.net-worth-primary-line')).toHaveTextContent(
    '8.000,00',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Hide balances' }))
  expect(
    container.querySelector('.net-worth-primary-line'),
  ).not.toHaveTextContent('8.000,00')
  expect(container.querySelector('[title*="8.000,00"]')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Show balances' }))
  expect(container.querySelector('.net-worth-primary-line')).toHaveTextContent(
    '8.000,00',
  )
  expect(JSON.stringify(report)).toBe(original)
})
it('opens category details and keeps the assets collapse keyboard accessible', async () => {
  setPreferences({ ...defaults, language: 'en' })
  render(
    <FinancialPrivacy>
      <NetWorthOverview
        report={syntheticReport()}
        positions={[]}
        period="1M"
        setPeriod={vi.fn()}
        chartSeries="value"
        seriesControl={null}
        methods={null}
        onComponent={vi.fn()}
        onPosition={vi.fn()}
      />
    </FinancialPrivacy>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Cash' }))
  expect(
    within(screen.getByRole('dialog')).getByText('Fictional checking'),
  ).toBeVisible()
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: /Close/ }),
  )
  expect(
    screen.queryByText('Momentum', { exact: true }),
  ).not.toBeInTheDocument()
  const toggle = screen.getByRole('button', { name: /^Assets/ })
  toggle.focus()
  await userEvent.keyboard('{Enter}')
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
})
