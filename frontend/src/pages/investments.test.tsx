import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvestmentWorkspace } from './investments'
import BrokerageImports from './investment-imports'
import type { Account } from '@/lib/api'

it('requires brokerage account confirmation, preserves duplicate warnings and safely reports stale previews', async () => {
  const batch = {
    id: 'synthetic-batch',
    filename: 'synthetic.csv',
    status: 'DRAFT',
    ready: true,
    preview_token: 'a'.repeat(64),
    counts: {},
    rows: [
      {
        id: 'synthetic-source',
        row_number: 1,
        status: 'EXACT_DUPLICATE',
        errors: [],
        candidate: null,
        decision: {},
      },
    ],
  }
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST')
      return new Response(
        JSON.stringify({
          detail: 'Preview changed; refresh before confirming',
        }),
        { status: 409 },
      )
    return new Response(
      JSON.stringify(
        path.endsWith('/profiles')
          ? []
          : path.endsWith('/synthetic-batch')
            ? batch
            : [batch],
      ),
    )
  })
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={client}>
      <BrokerageImports accounts={[account]} />
    </QueryClientProvider>,
  )
  await userEvent.click(
    await screen.findByRole('button', { name: 'synthetic.csv' }),
  )
  expect(await screen.findByText('EXACT_DUPLICATE')).toBeInTheDocument()
  const confirm = screen.getByRole('button', {
    name: 'Confirm brokerage import',
  })
  expect(confirm).toBeDisabled()
  expect(
    fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(0)
  await userEvent.click(
    screen.getByRole('checkbox', { name: /I confirm this brokerage account/ }),
  )
  await userEvent.click(confirm)
  expect(await screen.findByRole('alert')).toHaveTextContent('Preview changed')
  expect(screen.getByText('EXACT_DUPLICATE')).toBeInTheDocument()
  expect(
    fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1)
})

const account: Account = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Synthetic Brokerage',
  type: 'INVESTMENT',
  currency: 'BRL',
  institution: null,
  active: true,
  balance: '9470',
}
const asset = {
  id: '00000000-0000-0000-0000-000000000002',
  symbol: 'FAKE11',
  name: 'Synthetic fund',
  exchange: 'XBSP',
  currency: 'BRL',
  asset_type: 'ETF',
  isin: null,
}
const holding = {
  asset_id: asset.id,
  account_id: null,
  symbol: asset.symbol,
  name: asset.name,
  exchange: 'XBSP',
  currency: 'BRL',
  quantity: '6',
  average_cost: '100.50',
  cost_basis: '603',
  realized: '73',
  income: '0',
  last_price: null,
  price_date: null,
  price_source: null,
  price_stale: false,
  market_value: null,
  unrealized: null,
}
const totals = {
  currency: 'BRL',
  cash: '9470',
  known_holdings_value: '0',
  cost_basis: '603',
  realized: '73',
  income: '0',
  missing_prices: 1,
  total_value: null,
}
const portfolio = {
  as_of: '2026-09-30',
  method: 'WEIGHTED_AVERAGE',
  accounts: [
    {
      ...totals,
      id: account.id,
      name: account.name,
      active: true,
      market_value: null,
    },
  ],
  totals: [totals],
  holdings: [holding],
  positions: [{ ...holding, account_id: account.id }],
}

function setup(mode: 'normal' | 'error' | 'pending' = 'normal') {
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (mode === 'pending') return new Promise<Response>(() => {})
    if (mode === 'error')
      return new Response(
        JSON.stringify({ detail: 'Synthetic API unavailable' }),
        { status: 503 },
      )
    const data =
      init?.method === 'POST'
        ? path.endsWith('/activities/preview')
          ? {
              gross_amount: '1000',
              cash_amount: '1005',
              direction: 'OUT',
              resulting_quantity: '10',
            }
          : { ...asset }
        : path.includes('/portfolio')
          ? portfolio
          : path.endsWith('/assets')
            ? [asset]
            : []
    return new Response(JSON.stringify(data))
  })
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={client}>
      <InvestmentWorkspace
        accounts={[account]}
        categories={[]}
        initialDate="2026-09-30"
      />
    </QueryClientProvider>,
  )
  return fetch
}

it('renders exact holdings, cash and missing-price state without invented market value', async () => {
  setup()
  const table = await screen.findByRole('table', {
    name: 'Investment holdings',
  })
  expect(within(table).getByText('R$603.00')).toBeInTheDocument()
  expect(within(table).getByText('R$100.50')).toBeInTheDocument()
  expect(within(table).getByText('R$73.00')).toBeInTheDocument()
  expect(
    screen.getByText(/position\(s\) have no manual price/),
  ).toBeInTheDocument()
  expect(within(table).getAllByText('Unavailable')).toHaveLength(3)
})

it('opens security positions and scopes the portfolio to an investment account', async () => {
  const fetch = setup()
  await userEvent.click(await screen.findByRole('button', { name: 'FAKE11' }))
  expect(
    await screen.findByRole('heading', { name: 'Synthetic fund' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Position across accounts' }),
  ).toBeInTheDocument()
  await userEvent.selectOptions(
    screen.getByLabelText('Portfolio account'),
    account.id,
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          url.includes('account_id=' + account.id) &&
          url.includes('/portfolio'),
      ),
    ).toBe(true),
  )
})

it('creates manual assets through the API', async () => {
  const fetch = setup()
  await screen.findByRole('table', { name: 'Investment holdings' })
  await userEvent.click(screen.getByRole('button', { name: 'Add security' }))
  await userEvent.type(screen.getByLabelText('Security symbol'), 'DEMO')
  await userEvent.type(
    screen.getByLabelText('Security name'),
    'Synthetic international ETF',
  )
  await userEvent.type(screen.getByLabelText('Exchange'), 'XNYS')
  await userEvent.click(screen.getByRole('button', { name: 'Save security' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, init]) =>
          url.endsWith('/assets') &&
          init?.method === 'POST' &&
          JSON.parse(init.body as string).symbol === 'DEMO',
      ),
    ).toBe(true),
  )
})

it('previews a buy with fees and posts only after explicit confirmation using the same request ID', async () => {
  const fetch = setup()
  await screen.findByRole('table', { name: 'Investment holdings' })
  await userEvent.click(screen.getByRole('button', { name: 'Add activity' }))
  await userEvent.selectOptions(
    screen.getByLabelText('Activity security'),
    asset.id,
  )
  await userEvent.type(screen.getByLabelText('Quantity'), '10')
  await userEvent.type(screen.getByLabelText('Unit price'), '100')
  await userEvent.clear(screen.getByLabelText('Activity fees'))
  await userEvent.type(screen.getByLabelText('Activity fees'), '5')
  await userEvent.click(
    screen.getByRole('button', { name: 'Preview activity' }),
  )
  expect(await screen.findByText(/Resulting quantity 10/)).toBeInTheDocument()
  expect(
    fetch.mock.calls.some(
      ([url, init]) => url.endsWith('/activities') && init?.method === 'POST',
    ),
  ).toBe(false)
  await userEvent.click(
    screen.getByRole('button', { name: 'Confirm activity' }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, init]) => url.endsWith('/activities') && init?.method === 'POST',
      ),
    ).toBe(true),
  )
  const preview = fetch.mock.calls.find(([url]) =>
    url.endsWith('/activities/preview'),
  )![1]!
  const posted = fetch.mock.calls.find(
    ([url, init]) => url.endsWith('/activities') && init?.method === 'POST',
  )![1]!
  expect(JSON.parse(posted.body as string)).toEqual(
    JSON.parse(preview.body as string),
  )
})

it('adapts sell, dividend and fee inputs and invalidates confirmation when fields change', async () => {
  setup()
  await screen.findByRole('table', { name: 'Investment holdings' })
  await userEvent.click(screen.getByRole('button', { name: 'Add activity' }))
  await userEvent.selectOptions(screen.getByLabelText('Activity type'), 'SELL')
  expect(screen.getByLabelText('Quantity')).toBeInTheDocument()
  await userEvent.selectOptions(
    screen.getByLabelText('Activity type'),
    'DIVIDEND',
  )
  expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Gross amount')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Activity type'), 'FEE')
  expect(screen.queryByLabelText('Activity fees')).not.toBeInTheDocument()
})

it('adds a dated manual price from security detail', async () => {
  const fetch = setup()
  await userEvent.click(await screen.findByRole('button', { name: 'FAKE11' }))
  await userEvent.click(
    screen.getByRole('button', { name: 'Add manual price' }),
  )
  await userEvent.type(
    screen.getByLabelText('Manual price (BRL)'),
    '140.123456',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Save manual price' }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, init]) =>
          url.endsWith('/prices') &&
          JSON.parse(init!.body as string).price === '140.123456',
      ),
    ).toBe(true),
  )
})

it('opens the brokerage mapping and saved-profile workflow', async () => {
  setup()
  await screen.findByRole('table', { name: 'Investment holdings' })
  await userEvent.click(screen.getByRole('button', { name: 'Imports' }))
  expect(await screen.findByLabelText('Brokerage CSV file')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Preview brokerage CSV' }),
  ).toBeDisabled()
  await userEvent.click(screen.getByText('Column mapping (zero-based indexes)'))
  expect(screen.getByLabelText('Map quantity')).toHaveValue(4)
})

it('shows recoverable investment errors', async () => {
  setup('error')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Synthetic API unavailable',
  )
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})
it('shows a compact loading state', () => {
  setup('pending')
  expect(screen.getByRole('status')).toHaveTextContent(
    'Reconstructing investment positions',
  )
})
