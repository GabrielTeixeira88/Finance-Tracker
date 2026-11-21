import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsightsDashboard } from './insights-dashboard'
import { widgetIds, defaultInsightsLayout } from '@/lib/insights-layout'
import {
  setPreferences,
  getPreferences,
  setPreferenceWorkspace,
} from '@/lib/preferences'

const widgets = Object.fromEntries(
  widgetIds.map((id) => [id, <p key={id}>Content {id}</p>]),
) as Record<(typeof widgetIds)[number], React.ReactNode>
beforeEach(() => {
  setPreferenceWorkspace(false)
  setPreferences({ insightsLayout: defaultInsightsLayout() })
})
afterEach(() => {
  setPreferenceWorkspace(false)
  setPreferences({ insightsLayout: defaultInsightsLayout() })
})

it('stages visibility changes, cancels safely, saves and restores without storing financial payloads', async () => {
  const user = userEvent.setup()
  render(<InsightsDashboard widgets={widgets} />)
  await user.click(screen.getByRole('button', { name: 'Customize dashboard' }))
  await user.click(screen.getByRole('button', { name: 'Widgets' }))
  const picker = screen.getByRole('region', { name: 'Widgets' })
  await user.click(within(picker).getByRole('checkbox', { name: 'Sectors' }))
  expect(getPreferences().insightsLayout.hidden).toEqual([])
  expect(screen.queryByText('Content sector')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByText('Content sector')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Customize dashboard' }))
  await user.click(screen.getByRole('button', { name: 'Hide Sectors' }))
  await user.click(screen.getByRole('button', { name: 'Save layout' }))
  expect(getPreferences().insightsLayout.hidden).toEqual(['sector'])
  const stored = localStorage.getItem('finance-tracker-preferences-normal')!
  expect(stored).not.toContain('Content')
  expect(stored).not.toContain('balance')
  await user.click(screen.getByRole('button', { name: 'Customize dashboard' }))
  await user.click(screen.getByRole('button', { name: 'Restore defaults' }))
  await user.click(screen.getByRole('button', { name: 'Save layout' }))
  expect(getPreferences().insightsLayout.hidden).toEqual([])
})

it('keeps normal and demo layout preferences separate', () => {
  setPreferences({
    insightsLayout: { ...defaultInsightsLayout(), hidden: ['cash'] },
  })
  setPreferenceWorkspace(true)
  expect(getPreferences().insightsLayout.hidden).toEqual([])
  setPreferences({
    insightsLayout: { ...defaultInsightsLayout(), hidden: ['sector'] },
  })
  setPreferenceWorkspace(false)
  expect(getPreferences().insightsLayout.hidden).toEqual(['cash'])
  setPreferenceWorkspace(true)
  expect(getPreferences().insightsLayout.hidden).toEqual(['sector'])
})
