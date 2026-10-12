import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MarketDataSettings,
  PortfolioHistory,
  SecurityMarketData,
} from './market-data'
import { Settings } from './management'

beforeAll(async () => {
  // Load the real chart before interaction timing starts; parallel Vite transforms
  // on Windows can take longer than Testing Library's one-second query timeout.
  await import('@/components/portfolio-value-chart')
}, 20000)

const status = {
  settings: { automatic: false, reporting_currency: 'BRL', fx_provider: 'ECB' },
  running: false,
  interval_minutes: 360,
  providers: [
    { id: 'BRAPI', configured: false, detail: 'Public test symbols only' },
  ],
  sync: [],
}
const history = {
  currency: 'BRL',
  warning: 'Value, not performance',
  fx_provider: 'SYNTHETIC',
  points: [
    {
      date: '2026-09-29',
      value: '1234.123456',
      known_value: '1234.123456',
      missing_assets: [],
      missing_fx: [],
    },
    {
      date: '2026-09-30',
      value: null,
      known_value: '500',
      missing_assets: ['fake'],
      missing_fx: [],
    },
  ],
}
function setup(
  component: React.ReactNode,
  handler: (path: string, init?: RequestInit) => unknown,
) {
  const fetch = vi.fn(
    async (path: string, init?: RequestInit) =>
      new Response(JSON.stringify(handler(path, init))),
  )
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  render(<QueryClientProvider client={client}>{component}</QueryClientProvider>)
  return fetch
}

it('places Market Data under Settings and reports credential availability without secrets', async () => {
  setup(<Settings accounts={[]} categories={[]} />, () => status)
  await userEvent.click(screen.getByRole('button', { name: 'Market Data' }))
  expect(
    await screen.findByRole('heading', { name: 'Market Data' }),
  ).toBeInTheDocument()
  expect(screen.getByText('API key not configured')).toBeInTheDocument()
  expect(
    screen.getByLabelText('Enable automatic refresh while the API is running'),
  ).not.toBeChecked()
})

it('updates reporting preferences and refreshes explicitly rather than on read', async () => {
  const fetch = setup(<MarketDataSettings />, (path, init) =>
    init?.method === 'POST'
      ? { results: [] }
      : path.endsWith('/settings')
        ? status.settings
        : status,
  )
  await screen.findByText('No synchronization yet')
  expect(fetch.mock.calls.every(([, init]) => !init?.method)).toBe(true)
  await userEvent.selectOptions(
    screen.getByLabelText('Reporting currency'),
    'USD',
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([path, init]) =>
          path.endsWith('/settings') &&
          JSON.parse(init?.body as string).reporting_currency === 'USD',
      ),
    ).toBe(true),
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Refresh market data' }),
  )
  expect(await screen.findByText(/Refresh finished/)).toBeInTheDocument()
  expect(
    fetch.mock.calls.some(
      ([path, init]) => path.endsWith('/sync') && init?.method === 'POST',
    ),
  ).toBe(true)
})

it('renders exact portfolio values, keeps missing points unavailable and changes ranges through API queries', async () => {
  const fetch = setup(
    <PortfolioHistory accountId="synthetic-account" asOf="2026-09-30" />,
    (path) =>
      path.includes('/valuation?')
        ? {
            reporting: {
              currency: 'BRL',
              total_value: null,
              known_value: '500',
              missing_prices: 1,
              missing_fx: [],
            },
          }
        : history,
  )
  expect(await screen.findByText('Incomplete valuation')).toBeInTheDocument()
  await screen.findByText(/History is incomplete/)
  await userEvent.click(await screen.findByText('View portfolio chart data'))
  expect(await screen.findByText('R$1,234.123456')).toBeInTheDocument()
  expect(screen.getByText('Unavailable')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '1Y' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([path]) => path.includes('start=2025-09-30')),
    ).toBe(true),
  )
  await userEvent.click(screen.getByRole('button', { name: 'ALL' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([path]) => path.includes('/history?') && !path.includes('start='),
      ),
    ).toBe(true),
  )
  await userEvent.selectOptions(
    screen.getByLabelText('Valuation currency'),
    'JPY',
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([path]) =>
        path.includes('reporting_currency=JPY'),
      ),
    ).toBe(true),
  )
})

it('shows source and convention and preserves explicit manual pricing controls', async () => {
  const data = {
    pricing: {
      mode: 'MANUAL',
      provider: null,
      symbol_override: null,
      blocked_from: null,
      blocked_to: null,
    },
    mapping: {
      provider: 'BRAPI',
      symbol: 'PETR4',
      currency: 'BRL',
      exchange: 'XBSP',
    },
    mapping_error: null,
    sync: null,
    observations: [
      {
        id: 'fake-price',
        price_date: '2026-09-30',
        price: '41.123456',
        currency: 'BRL',
        source: 'BRAPI',
        price_type: 'ADJUSTED',
        fetched_at: '2026-09-30T18:00:00Z',
      },
    ],
  }
  const fetch = setup(<SecurityMarketData id="synthetic" />, (_path, init) =>
    init?.method === 'PUT' ? data.pricing : data,
  )
  expect(await screen.findByText('Adjusted / not eligible')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Pricing preferences and coverage'))
  await userEvent.click(screen.getByText('Cached price observations'))
  expect(screen.getByLabelText('Pricing mode')).toHaveValue('MANUAL')
  await userEvent.selectOptions(
    screen.getByLabelText('Pricing mode'),
    'AUTOMATIC',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save pricing' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([, init]) =>
          init?.method === 'PUT' &&
          JSON.parse(init.body as string).mode === 'AUTOMATIC',
      ),
    ).toBe(true),
  )
  expect(screen.getByText('R$41.123456')).toBeInTheDocument()
})
