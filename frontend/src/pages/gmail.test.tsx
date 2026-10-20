import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Settings } from './management'
import { GmailQueue } from './gmail'

function setup(connected = false, failure = false) {
  const state = {
    status: connected ? 'CONNECTED' : 'DISCONNECTED',
    mailbox: null,
    label_id: null,
    account_id: null,
    last_attempt: null,
    last_success: null,
    error: null,
    backfill_start: null,
    backfill_end: null,
    active_run: null,
    polling_minutes: 5,
    paused: true,
    senders: [],
    pending: 0,
    configured: true,
  }
  const fetch = vi.fn(async (path: string, options?: RequestInit) => {
    let data: unknown = []
    if (path === '/api/gmail') data = state
    if (path === '/api/gmail/labels')
      data = [{ id: 'demo', name: 'Synthetic notifications' }]
    if (path === '/api/gmail/connect')
      data = {
        authorization_url:
          'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic',
      }
    if (path === '/api/gmail/disconnect') state.status = 'DISCONNECTED'
    if (path.startsWith('/api/gmail'))
      expect(options?.headers).toHaveProperty('X-Finance-Gmail', '1')
    return {
      ok: !failure,
      status: failure ? 409 : 200,
      json: async () =>
        failure ? { detail: 'RECONNECT_REQUIRED' } : structuredClone(data),
    }
  })
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    fetch,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  }
}

test('Settings exposes Gmail, readonly warning and explicit browser authorization', async () => {
  const { wrapper, fetch } = setup()
  render(<Settings categories={[]} accounts={[]} />, { wrapper })
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Gmail' }))
  expect(await screen.findByText('No Gmail connection')).toBeInTheDocument()
  expect(
    screen.getByText(/not an OAuth permission boundary/),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Connect Gmail' }))
  expect(
    await screen.findByRole('link', {
      name: 'Continue to Google authorization',
    }),
  ).toHaveAttribute(
    'href',
    'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic',
  )
  expect(fetch.mock.calls.some(([path]) => path === '/api/gmail/connect')).toBe(
    true,
  )
  expect(localStorage.length).toBe(0)
})

test('connected settings offers label/account mapping, bounded dates and disconnect', async () => {
  const { wrapper, fetch } = setup(true)
  render(<Settings categories={[]} accounts={[]} />, { wrapper })
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Gmail' }))
  expect(
    await screen.findByRole('option', { name: 'Synthetic notifications' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Default target account')).toBeInTheDocument()
  expect(screen.getByLabelText('Backfill from')).toBeInTheDocument()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await user.click(screen.getByRole('button', { name: 'Disconnect' }))
  expect(
    fetch.mock.calls.some(([path]) => path === '/api/gmail/disconnect'),
  ).toBe(false)
  confirm.mockReturnValue(true)
  await user.click(screen.getByRole('button', { name: 'Disconnect' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([path]) => path === '/api/gmail/disconnect'),
    ).toBe(true),
  )
})

test('empty review queue does not offer approval and shows setup guidance', async () => {
  const { wrapper } = setup()
  render(<GmailQueue accounts={[]} categories={[]} />, { wrapper })
  expect(await screen.findByText('No Gmail candidates')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Approve selected' }),
  ).toBeDisabled()
  expect(
    screen.getByText(/do not affect balances until you confirm/),
  ).toBeInTheDocument()
})

test('provider failure is displayed without credentials or invented candidates', async () => {
  const { wrapper } = setup(false, true)
  render(<GmailQueue accounts={[]} categories={[]} />, { wrapper })
  expect(await screen.findByText('RECONNECT_REQUIRED')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Approve selected' }),
  ).not.toBeInTheDocument()
})
