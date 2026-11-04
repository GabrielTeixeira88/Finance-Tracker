import { act, fireEvent, render, screen } from '@testing-library/react'
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

it('selects themes, charts, fonts and financial colors independently without API calls', () => {
  act(() => setPreferences({ ...defaults, language: 'en' }))
  render(<Appearance />)
  fireEvent.click(screen.getByRole('button', { name: 'Carbon Amber' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cool' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Red gains / green losses' }),
  )
  fireEvent.click(screen.getByRole('button', { name: /Geist/ }))
  expect(getPreferences()).toMatchObject({
    palette: 'carbon-amber',
    chartPalette: 'cool',
    financialColors: 'reversed',
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
