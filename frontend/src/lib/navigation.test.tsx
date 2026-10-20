import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  navigateTo,
  readRoute,
  rememberLedgerFilters,
  useRoute,
  useSection,
} from './navigation'

function Destination() {
  const route = useRoute()
  const [section, setSection] = useSection(
    ['categories', 'rules'],
    'categories',
  )
  return (
    <>
      <p>
        {route.page}: {section}
      </p>
      <button onClick={() => setSection('rules')}>Open rules</button>
    </>
  )
}

it('restores a bookmark and keeps independent section state in browser history', async () => {
  window.history.replaceState(null, '', '#/settings?view=categories')
  render(<Destination />)
  await userEvent.click(screen.getByRole('button', { name: 'Open rules' }))
  expect(window.location.hash).toBe('#/settings?view=rules')
  expect(screen.getByText('Settings: rules')).toBeInTheDocument()
  await act(async () => {
    window.history.back()
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  expect(screen.getByText('Settings: categories')).toBeInTheDocument()
  await act(async () => {
    window.history.forward()
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  expect(screen.getByText('Settings: rules')).toBeInTheDocument()
})

it('round trips account scope and exact filter strings without numeric conversion', () => {
  navigateTo('Account', 'a/b')
  rememberLedgerFilters({
    amount_min: '9007199254740993.123456',
    search: 'Synthetic & Co',
  })
  const route = readRoute()
  expect(route.accountId).toBe('a/b')
  expect(route.params.get('amount_min')).toBe('9007199254740993.123456')
  expect(route.params.get('search')).toBe('Synthetic & Co')
  expect(route.params.get('view')).toBe('activity')
})

it('uses Overview for an unknown route and validates section values', () => {
  expect(readRoute('#/not-a-page').page).toBe('Overview')
  window.history.replaceState(null, '', '#/settings?view=unknown')
  render(<Destination />)
  expect(screen.getByText('Settings: categories')).toBeInTheDocument()
})
