import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import Appearance from '@/pages/appearance'
import {
  defaults,
  getPreferences,
  setPreferences,
  setPreferenceWorkspace,
  themes,
} from './preferences'
afterEach(() =>
  act(() => {
    localStorage.clear()
    setPreferenceWorkspace(false)
    setPreferences(defaults)
  }),
)

it('keeps language first and sidebar order last, without financial-color controls', () => {
  act(() => setPreferences({ ...defaults, language: 'en' }))
  const { container } = render(<Appearance />)
  const sections = container.querySelectorAll('.appearance-settings > section')
  expect(
    within(sections[0] as HTMLElement).getByLabelText('Interface language'),
  ).toBeVisible()
  expect(
    within(sections[sections.length - 1] as HTMLElement).getByRole('list', {
      name: 'Sidebar order',
    }),
  ).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Financial colors' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Carbon Amber' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cool' }))
  fireEvent.click(screen.getByRole('button', { name: /Geist/ }))
  expect(getPreferences()).toMatchObject({
    palette: 'carbon-amber',
    chartPalette: 'cool',
    financialColors: 'standard',
    font: 'geist',
  })
  expect(screen.getByRole('button', { name: 'Carbon Amber' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  setPreferenceWorkspace(false)
  expect(getPreferences().chartPalette).toBe('cool')
})

it.each(themes)(
  'preserves independent selections when switching to %s',
  (palette) => {
    setPreferences({
      ...defaults,
      font: 'serif',
      chartPalette: 'warm',
      financialColors: 'neutral',
    })
    setPreferences({ palette })
    setPreferenceWorkspace(false)
    expect(getPreferences()).toMatchObject({
      palette,
      font: 'serif',
      chartPalette: 'warm',
      financialColors: 'neutral',
    })
  },
)
