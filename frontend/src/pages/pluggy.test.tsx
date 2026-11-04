import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, it, expect } from 'vitest'
import { PluggySettings } from './pluggy'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: ({ onSuccess }: { onSuccess: (event: unknown) => void }) => (
    <button
      onClick={() =>
        onSuccess({ item: { id: '10000000-0000-4000-8000-000000000001' } })
      }
    >
      Complete synthetic provider connection
    </button>
  ),
}))
const account = {
  id: 'local',
  name: 'Synthetic checking',
  type: 'CHECKING' as const,
  currency: 'BRL',
  institution: null,
  active: true,
  balance: '500',
}
const item = {
  id: 'i',
  external_id: '10000000-0000-4000-8000-000000000001',
  name: 'Synthetic institution',
  status: 'UPDATED',
  paused: false,
  last_sync: '2026-10-01',
  error: null,
  warnings: [],
}
const resource = {
  id: 'r',
  item_id: 'i',
  kind: 'ACCOUNT',
  external_id: 'remote',
  digest: 'fake-digest',
  account_id: null,
  asset_id: null,
  data: {
    name: 'Synthetic remote bank',
    type: 'BANK',
    currencyCode: 'BRL',
    balance: '9007199254740993.123456',
  },
}
function setup({ configured = true, fail = false } = {}) {
  window.history.replaceState(null, '', '#/settings?view=pluggy&item=i')
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    const path = url.split('?')[0]
    const value =
      path === '/api/pluggy/status'
        ? {
            configured,
            error: null,
            automatic_posting: false,
            payment_initiation: false,
          }
        : path === '/api/pluggy/items'
          ? options?.method === 'POST'
            ? { id: 'i' }
            : [item]
          : path === '/api/pluggy/resources'
            ? [resource]
            : path === '/api/pluggy/reviews'
              ? []
              : path === '/api/pluggy/credentials'
                ? { saved: true }
                : path === '/api/pluggy/connect-token'
                  ? { access_token: 'FAKE_SCOPED_TOKEN' }
                  : path === '/api/pluggy/discover'
                    ? [
                        {
                          external_id: item.external_id,
                          name: 'Synthetic existing',
                          status: 'UPDATED',
                        },
                      ]
                    : path.endsWith('/review')
                      ? { id: 'batch' }
                      : {}
    return new Response(
      JSON.stringify(
        fail && path === '/api/pluggy/items'
          ? { detail: 'Synthetic unavailable' }
          : value,
      ),
      { status: fail && path === '/api/pluggy/items' ? 503 : 200 },
    )
  })
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  render(
    <QueryClientProvider client={client}>
      <PluggySettings accounts={[account]} />
    </QueryClientProvider>,
  )
  return { fetch, client }
}

it('renders exact provider amounts as observations and uses backend product filtering', async () => {
  const { fetch } = setup()
  expect(
    await screen.findByText('R$9,007,199,254,740,993.123456'),
  ).toBeVisible()
  expect(
    screen.getByText(/Pluggy processes connected financial data/),
  ).toBeVisible()
  expect(screen.queryByText('FAKE_SCOPED_TOKEN')).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Data product'), 'BILL')
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => url.includes('kind=BILL'))).toBe(
      true,
    ),
  )
  expect(window.location.hash).toContain('kind=BILL')
})

it('sends credentials only on explicit save, clears the form and avoids mutation caches or browser storage', async () => {
  const { fetch, client } = setup({ configured: false })
  await userEvent.type(screen.getByLabelText('Client ID'), 'FAKE_CLIENT')
  await userEvent.type(screen.getByLabelText('Client secret'), 'FAKE_SECRET')
  await userEvent.click(screen.getByLabelText(/I understand Pluggy/))
  await userEvent.click(
    screen.getByRole('button', { name: 'Save in OS vault' }),
  )
  await waitFor(() =>
    expect(screen.getByLabelText('Client secret')).toHaveValue(''),
  )
  const call = fetch.mock.calls.find(
    ([url]) => url === '/api/pluggy/credentials',
  )
  expect(call?.[1]?.headers).toMatchObject({ 'X-Finance-Pluggy': '1' })
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({
    client_id: 'FAKE_CLIENT',
    client_secret: 'FAKE_SECRET',
    acknowledge_external_processing: true,
  })
  expect(client.getMutationCache().getAll()).toHaveLength(0)
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
    ),
  ).not.toContain('FAKE_SECRET')
  expect(localStorage.length).toBe(0)
})

it('loads the official connection UI only after an explicit action and adopts its scoped result', async () => {
  const { fetch } = setup()
  expect(
    screen.queryByRole('button', {
      name: 'Complete synthetic provider connection',
    }),
  ).not.toBeInTheDocument()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Connect institution' }),
  )
  await userEvent.click(
    await screen.findByRole('button', {
      name: 'Complete synthetic provider connection',
    }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, options]) =>
          url === '/api/pluggy/items' && options?.method === 'POST',
      ),
    ).toBe(true),
  )
  expect(screen.queryByText('FAKE_SCOPED_TOKEN')).not.toBeInTheDocument()
  expect(localStorage.length).toBe(0)
})

it('maps account identity without sending amounts or changing ledger history', async () => {
  const { fetch } = setup()
  await userEvent.click(await screen.findByRole('button', { name: 'Map' }))
  const dialog = screen.getByRole('dialog')
  await userEvent.selectOptions(
    within(dialog).getByLabelText('Local account'),
    'local',
  )
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Save mapping' }),
  )
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/mapping'))).toBe(
      true,
    ),
  )
  const sent = fetch.mock.calls.find(([url]) => url.endsWith('/mapping'))
  expect(JSON.parse(String(sent?.[1]?.body))).toEqual({
    account_id: 'local',
    asset_id: null,
  })
  expect(
    fetch.mock.calls.every(([url]) => !url.includes('/transactions')),
  ).toBe(true)
})

it('shows recoverable errors without loading external provider UI', async () => {
  setup({ fail: true })
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(
    screen.queryByRole('button', {
      name: 'Complete synthetic provider connection',
    }),
  ).not.toBeInTheDocument()
})
