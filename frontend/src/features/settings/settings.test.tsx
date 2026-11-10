import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { SettingsLayout } from './settings-layout'
import { GeneralSettings, FXSettings } from './general'
import { GroupsSettings } from './groups'
import { SecuritiesSettings } from './securities'
import { ExportsSettings } from './exports'
import { DemoContext } from '@/lib/demo-runtime'
import { DemoProvider } from '@/components/demo-provider'
import { setPreferences, defaults } from '@/lib/preferences'
import type { Account } from '@/lib/api'
import Appearance from '@/pages/appearance'

const account: Account = {
  id: 'account',
  name: 'Fictional checking',
  type: 'CHECKING',
  currency: 'BRL',
  institution: null,
  active: true,
  balance: '1234.123456',
}

it('keeps theme illustrations outside the application landmark hierarchy', () => {
  wrap(
    <main>
      <Appearance embedded />
    </main>,
  )
  expect(screen.getAllByRole('main')).toHaveLength(1)
  expect(document.querySelectorAll('.theme-preview-content')).toHaveLength(6)
})
function wrap(node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      {node}
    </QueryClientProvider>,
  )
}
function api(handler: (path: string, options?: RequestInit) => unknown) {
  const fetch = vi.fn(
    async (path: RequestInfo | URL, options?: RequestInit) =>
      new Response(JSON.stringify(handler(String(path), options)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
beforeEach(() => {
  setPreferences({ ...defaults, language: 'en' })
  window.history.replaceState(null, '', '#/settings')
})

it('shows dated cached FX, source and retrieval time without rounding the rate', async () => {
  api(() => ({
    total: 1,
    items: [
      {
        id: 'rate',
        base_currency: 'EUR',
        quote_currency: 'BRL',
        rate_date: '2026-09-30',
        rate: '6.123456789012345678',
        provider: 'ECB',
        fetched_at: '2026-10-01T12:00:00Z',
      },
    ],
  }))
  wrap(<FXSettings />)
  await screen.findByText('6.123456789012345678')
  expect(
    screen.getByRole('columnheader', { name: 'Retrieved' }),
  ).toBeInTheDocument()
  expect(screen.getByText('2026-10-01T12:00:00Z')).toHaveAttribute(
    'datetime',
    '2026-10-01T12:00:00Z',
  )
  expect(screen.getByText('ECB')).toBeInTheDocument()
})

it('renders source Settings groups and real deep links without unsupported services', () => {
  wrap(
    <SettingsLayout view="appearance">
      <h1>Appearance editor</h1>
    </SettingsLayout>,
  )
  expect(screen.getByRole('link', { name: 'Appearance' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(screen.getByRole('link', { name: 'Accounts' })).toHaveAttribute(
    'href',
    '#/settings?view=accounts',
  )
  expect(screen.getByRole('link', { name: 'Spending' })).toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: /\bAI\b|cloud|contribution/i }),
  ).not.toBeInTheDocument()
})
it('keeps reporting currency persistence separate from ledger fields', async () => {
  let settings = {
    automatic: false,
    reporting_currency: 'BRL',
    fx_provider: 'ECB',
  }
  const fetch = api((path, options) => {
    if (path === '/api/market-data/settings') {
      settings = JSON.parse(String(options?.body))
      return settings
    }
    if (path.startsWith('/api/settings/fx')) return { total: 0, items: [] }
    return {
      settings,
      providers: [],
      sync: [],
      running: false,
      interval_minutes: 360,
    }
  })
  wrap(<GeneralSettings />)
  await userEvent.selectOptions(
    await screen.findByLabelText('Reporting currency'),
    'EUR',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('status')
  expect(settings).toEqual({
    automatic: false,
    reporting_currency: 'EUR',
    fx_provider: 'ECB',
  })
  expect(
    fetch.mock.calls.some(([path]) => String(path).includes('/transactions')),
  ).toBe(false)
})
it('creates local group membership through the real write contract', async () => {
  const fetch = api((path, options) => {
    if (path === '/api/settings/account-groups' && options?.method === 'POST')
      return { id: 'new', ...JSON.parse(String(options.body)) }
    return []
  })
  wrap(<GroupsSettings accounts={[account]} />)
  await userEvent.click(
    screen.getByRole('button', { name: 'Add account group' }),
  )
  await userEvent.type(
    screen.getByLabelText('Group name'),
    'Fictional household',
  )
  await userEvent.click(
    screen.getByRole('checkbox', { name: /Fictional checking/ }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  const call = fetch.mock.calls.find(
    ([, options]) => options?.method === 'POST',
  )
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({
    name: 'Fictional household',
    description: '',
    account_ids: ['account'],
  })
})
it('filters securities without fetching live prices or exposing financial identity editing', async () => {
  const fetch = api(() => [
    {
      id: 'sim',
      symbol: 'SIM-GLOBAL',
      name: 'Fictional global ETF',
      asset_type: 'ETF',
      exchange: 'SIMULATED',
      currency: 'BRL',
      isin: null,
    },
    {
      id: 'bond',
      symbol: 'CDB',
      name: 'Illustrative CDB',
      asset_type: 'BOND',
      exchange: 'CONTRACT',
      currency: 'BRL',
      isin: null,
    },
  ])
  wrap(<SecuritiesSettings />)
  await screen.findByText('SIM-GLOBAL')
  await userEvent.selectOptions(screen.getByLabelText('Type'), 'BOND')
  expect(screen.queryByText('SIM-GLOBAL')).not.toBeInTheDocument()
  expect(screen.getByText('Illustrative CDB')).toBeInTheDocument()
  expect(
    fetch.mock.calls.every(
      ([path]) => String(path) === '/api/investments/assets',
    ),
  ).toBe(true)
})
it('never opens personal backup services from the demo', async () => {
  const fetch = api(() => ({
    datasets: ['accounts', 'transactions'],
    formats: ['json', 'csv'],
    max_rows: 50000,
  }))
  wrap(
    <DemoContext.Provider
      value={{
        runtime: {
          mode: 'local_demo',
          profile: 'Fictional',
          start_date: '2024-10-01',
          end_date: '2026-09-30',
          generation: 'owned',
          scenario: 'unified',
        },
      }}
    >
      <ExportsSettings />
    </DemoContext.Provider>,
  )
  await userEvent.click(screen.getByRole('tab', { name: 'Local backups' }))
  expect(screen.getByRole('note')).toHaveTextContent('disabled in the demo')
  expect(
    fetch.mock.calls.some(([path]) => String(path).includes('/backups')),
  ).toBe(false)
})
it('boots the maintenance UI without mounting financial screens', async () => {
  const fetch = api((path) =>
    path === '/api/runtime'
      ? { mode: 'normal', maintenance: true }
      : { maintenance: true, max_bytes: 128 * 1024 * 1024, items: [] },
  )
  wrap(
    <DemoProvider>
      <p>Personal finance screen</p>
    </DemoProvider>,
  )
  await screen.findByRole('heading', { name: 'Database maintenance' })
  expect(screen.queryByText('Personal finance screen')).not.toBeInTheDocument()
  expect(
    fetch.mock.calls.some(([path]) => String(path).includes('/accounts')),
  ).toBe(false)
})
