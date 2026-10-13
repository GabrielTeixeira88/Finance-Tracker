import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { startDate } from '@/lib/investment-analytics'
import InvestmentAnalytics, {
  SecurityClassification,
} from './investment-analytics'

beforeAll(async () => {
  await Promise.all([
    import('@/components/performance-chart'),
    import('@/components/income-chart'),
  ])
}, 20000)

const metric = (value: string | null, reasons: string[] = []) => ({
  value,
  reasons,
  quality: value === null ? 'UNAVAILABLE' : 'COMPLETE',
  method: 'SYNTHETIC_TEST',
})
const performance = {
  start: '2026-06-30',
  end: '2026-09-30',
  currency: 'BRL',
  opening_value: '10000',
  ending_value: '20000',
  net_external_flows: '9000',
  twr: metric('10'),
  xirr: metric(null, ['POTENTIALLY_MULTIPLE_ROOTS']),
  absolute_gain: metric('1000'),
  points: [
    { date: '2026-06-30', return_percent: '0' },
    { date: '2026-09-30', return_percent: '10' },
  ],
  flows: [],
  benchmark: null,
}

it('clamps calendar month and leap-year boundaries and keeps custom dates explicit', () => {
  expect(startDate('1M', '2026-03-31', '')).toBe('2026-02-28')
  expect(startDate('1Y', '2024-02-29', '')).toBe('2023-02-28')
  expect(startDate('YTD', '2026-09-30', '')).toBe('2025-12-31')
  expect(startDate('Custom', '2026-09-30', '2026-02-15')).toBe('2026-02-15')
})
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

it('renders exact returns separately from contributions, changes ranges and selects a real benchmark', async () => {
  const fetch = setup(
    <InvestmentAnalytics
      view="Performance"
      accountId="synthetic-account"
      asOf="2026-09-30"
      onSecurity={vi.fn()}
    />,
    (path) =>
      path.includes('/assets')
        ? [
            {
              id: 'synthetic-benchmark',
              symbol: 'DEMO',
              name: 'Fictional benchmark',
              exchange: 'SYNTHETIC',
              currency: 'BRL',
              asset_type: 'ETF',
              isin: null,
            },
          ]
        : path.includes('/insights')
          ? { warning: 'Fees already included', currency: 'BRL', positions: [] }
          : performance,
  )
  expect(await screen.findByText('10%')).toBeInTheDocument()
  expect(screen.getByText('potentially multiple roots')).toBeInTheDocument()
  expect(screen.getByText('XIRR · annualized')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '1Y' }))
  await waitFor(() =>
    expect(fetch.mock.calls.some(([p]) => p.includes('start=2025-09-30'))).toBe(
      true,
    ),
  )
  await userEvent.selectOptions(
    screen.getByLabelText('Benchmark'),
    'synthetic-benchmark',
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([p]) =>
        p.includes('benchmark_id=synthetic-benchmark'),
      ),
    ).toBe(true),
  )
  await userEvent.click(screen.getByText('View exact performance data'))
  expect(
    screen.getByRole('figure', {
      name: 'Cash-flow-adjusted investment performance',
    }),
  ).toBeInTheDocument()
})

it('keeps incomplete allocation weights unavailable and drills into a security', async () => {
  const open = vi.fn()
  setup(
    <InvestmentAnalytics
      view="Allocation"
      accountId=""
      asOf="2026-09-30"
      onSecurity={open}
    />,
    (path) =>
      path.endsWith('/assets')
        ? []
        : {
            currency: 'BRL',
            quality: 'PARTIAL',
            reasons: ['MISSING_PRICE'],
            total_value: null,
            known_value: '500',
            metadata_policy: 'Unknown metadata is never inferred',
            concentration: { '1': null },
            groups: {
              security: [
                {
                  name: 'FAKE',
                  value: null,
                  weight_percent: null,
                  members: [{ account_id: 'a', asset_id: 's' }],
                },
              ],
              sector: [
                {
                  name: 'Unknown',
                  value: null,
                  weight_percent: null,
                  members: [],
                },
              ],
            },
          },
  )
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Incomplete valuation',
    ),
  )
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'FAKE' }))
  await userEvent.click(screen.getByRole('button', { name: 'View security' }))
  expect(open).toHaveBeenCalledWith('s')
  await userEvent.click(screen.getByRole('button', { name: 'sector' }))
  expect(screen.getByRole('button', { name: 'Unknown' })).toBeInTheDocument()
})

it('shows an explicit empty return state rather than a zero chart for unfunded history', async () => {
  setup(
    <InvestmentAnalytics
      view="Performance"
      accountId=""
      asOf="2026-09-30"
      onSecurity={vi.fn()}
    />,
    (path) =>
      path.includes('/assets')
        ? []
        : path.includes('/insights')
          ? { warning: 'No positions', currency: 'BRL', positions: [] }
          : {
              ...performance,
              twr: metric(null, ['NO_FUNDED_RETURN_PERIOD']),
              points: performance.points.map((p) => ({
                ...p,
                return_percent: null,
              })),
            },
  )
  expect(
    await screen.findByText('No return history available'),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('figure', {
      name: 'Cash-flow-adjusted investment performance',
    }),
  ).not.toBeInTheDocument()
})

it('reports recorded gross, fees, taxes and net income and supports yearly grouping', async () => {
  setup(
    <InvestmentAnalytics
      view="Income"
      accountId=""
      asOf="2026-09-30"
      onSecurity={vi.fn()}
    />,
    (path) =>
      path.endsWith('/assets')
        ? []
        : {
            events: [
              {
                id: 'i',
                date: '2026-09-01',
                account_id: 'a',
                account: 'Fictional account',
                asset_id: null,
                symbol: 'Cash interest',
                type: 'INTEREST',
                currency: 'BRL',
                gross: '100',
                fees: '2',
                taxes: '3',
                net: '95',
              },
            ],
            months: [
              {
                month: '2026-09',
                currency: 'BRL',
                gross: '100',
                fees: '2',
                taxes: '3',
                net: '95',
              },
            ],
            breakdowns: {
              year: [
                {
                  id: '2026',
                  name: '2026',
                  currency: 'BRL',
                  gross: '100',
                  fees: '2',
                  taxes: '3',
                  net: '95',
                },
              ],
            },
          },
  )
  expect(await screen.findByText('Fictional account')).toBeInTheDocument()
  await userEvent.selectOptions(
    screen.getByLabelText('Group income by'),
    'year',
  )
  expect(screen.getByText('2026 · BRL')).toBeInTheDocument()
  expect(screen.getAllByText(/95/).length).toBeGreaterThan(0)
})

it('saves explicit security metadata without changing activity amounts', async () => {
  const fetch = setup(<SecurityClassification id="fake" />, (_path, init) =>
    init?.method === 'PUT'
      ? JSON.parse(String(init.body))
      : { sector: null, geography: null },
  )
  await userEvent.click(
    screen.getByText('Sector and geographic classification'),
  )
  await userEvent.type(
    await screen.findByLabelText('Sector'),
    'Synthetic sector',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Save classification' }),
  )
  await waitFor(() =>
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(
      true,
    ),
  )
  const call = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')!
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    sector: 'Synthetic sector',
    geography: '',
  })
})
