import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import Appearance from './appearance'
import { AppShell } from '@/components/app-shell'
import {
  defaults,
  getPreferences,
  setPreferences,
  setPreferenceWorkspace,
} from '@/lib/preferences'
import { defaultSidebarOrder } from '@/lib/sidebar-order'
afterEach(() => {
  act(() => {
    setPreferenceWorkspace(true)
    setPreferences(defaults)
    setPreferenceWorkspace(false)
    setPreferences(defaults)
  })
})
it('reorders desktop and drawer icons immediately, persists locally and restores defaults', async () => {
  setPreferenceWorkspace(false)
  setPreferences(defaults)
  const { container } = render(
    <AppShell page="Settings" navigate={vi.fn()}>
      <Appearance />
    </AppShell>,
  )
  const desktop = () =>
    Array.from(
      container.querySelectorAll('.desktop-sidebar .primary-nav button'),
    ).map((n) => n.getAttribute('aria-label'))
  expect(desktop()).toEqual(defaultSidebarOrder)
  const settings = screen.getByRole('list', { name: 'Sidebar order' })
  expect(
    within(settings).getByRole('button', { name: 'Move Dashboard up' }),
  ).toBeDisabled()
  await userEvent.click(
    within(settings).getByRole('button', { name: 'Move Goals up' }),
  )
  const moved = [
    'Dashboard',
    'Accounts',
    'Activities',
    'Holdings',
    'Goals',
    'Insights',
    'Settings',
  ]
  expect(desktop()).toEqual(moved)
  expect(
    Array.from(container.querySelectorAll('dialog .primary-nav button')).map(
      (n) => n.getAttribute('aria-label'),
    ),
  ).toEqual(moved)
  expect(
    JSON.parse(localStorage.getItem('finance-tracker-preferences-normal')!)
      .sidebarOrder,
  ).toEqual(moved)
  act(() => {
    setPreferenceWorkspace(true)
    setPreferences(defaults)
  })
  expect(desktop()).toEqual(defaultSidebarOrder)
  act(() => setPreferenceWorkspace(false))
  expect(desktop()).toEqual(moved)
  await userEvent.click(
    screen.getByRole('button', { name: 'Restore default order' }),
  )
  expect(desktop()).toEqual(defaultSidebarOrder)
  expect(getPreferences().sidebarOrder).toEqual(defaultSidebarOrder)
})
