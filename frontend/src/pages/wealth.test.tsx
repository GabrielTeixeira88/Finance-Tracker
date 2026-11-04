import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { NetWorthWorkspace } from './wealth'
import Goals from './goals'
import { AppShell } from '@/components/app-shell'

vi.mock('@/components/portfolio-value-chart', () => ({
  PortfolioValueChart: ({ label }: { label: string }) => (
    <div aria-label={label} />
  ),
}))
function wrap(node: React.ReactNode, hash = '#/dashboard?view=net-worth') {
  window.history.replaceState(null, '', hash)
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
const report = {
  currency: 'BRL',
  start: '2025-01-01',
  end: '2026-09-30',
  value: '220000',
  assets: '380000',
  liabilities: '160000',
  known_value: '220000',
  complete: true,
  change: '10000',
  debt_to_assets: '0.421053',
  liquid_share: '0.1',
  method: 'Historical ledger',
  categories: [],
  points: [
    {
      date: '2026-09-30',
      value: '220000',
      known_value: '220000',
      complete: true,
    },
  ],
  components: [],
}

it('renders net worth and changes the requested historical period', async () => {
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(url.startsWith('/api/net-worth') ? report : []),
      ),
  )
  vi.stubGlobal('fetch', fetch)
  wrap(<NetWorthWorkspace navigate={vi.fn()} initialEnd="2026-09-30" />)
  expect(await screen.findByText(/220,000/)).toBeVisible()
  await userEvent.selectOptions(screen.getByLabelText('Chart series'), 'assets')
  expect(await screen.findByLabelText('Assets')).toBeVisible()
  await userEvent.selectOptions(
    screen.getByLabelText('Chart series'),
    'liabilities',
  )
  expect(await screen.findByLabelText('Liabilities')).toBeVisible()
  await userEvent.selectOptions(screen.getByLabelText('Period'), '3M')
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('start=2026-07-01'),
      expect.anything(),
    ),
  )
})

it('shows incomplete values instead of inventing zero', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.startsWith('/api/net-worth')
              ? {
                  ...report,
                  value: null,
                  assets: null,
                  liabilities: null,
                  complete: false,
                }
              : [],
          ),
        ),
    ),
  )
  wrap(<NetWorthWorkspace navigate={vi.fn()} initialEnd="2026-09-30" />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Incomplete valuation',
  )
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
})

it('submits a dated manual asset through the API', async () => {
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(url.startsWith('/api/net-worth') ? report : []),
      ),
  )
  vi.stubGlobal('fetch', fetch)
  wrap(<NetWorthWorkspace navigate={vi.fn()} initialEnd="2026-09-30" />)
  await userEvent.click(screen.getByRole('tab', { name: 'Assets' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Add asset' }),
  )
  await userEvent.type(screen.getByLabelText('Name'), 'Fictional vehicle')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/manual-positions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Fictional vehicle'),
      }),
    ),
  )
})

it('waits for the initial list and displays a newly saved goal without reload', async () => {
  let releaseInitial!: (value: Response) => void
  let initial = true
  let created = false
  const detail = {
    goal: {
      id: 'new-goal',
      name: 'Emergency fund',
      mode: 'ACCOUNT',
      currency: 'BRL',
      target: '20000',
      start_date: '2026-01-01',
      deadline: null,
      status: 'ACTIVE',
      notes: '',
    },
    saved: '0',
    allocated: '0',
    remaining: '20000',
    warnings: [],
    entries: [],
    progress: '0',
    milestones: [],
    required_monthly: null,
    projected_completion: null,
    overdue: false,
    history: [],
    projection_method: 'No interest',
  }
  const fetch = vi.fn<
    (url: string, options?: RequestInit) => Promise<Response>
  >(async (url, options) => {
    if (url === '/api/goals' && options?.method === 'POST') {
      created = true
      return new Response(JSON.stringify(detail.goal), { status: 201 })
    }
    if (url === '/api/goals' && initial) {
      initial = false
      return new Promise<Response>((resolve) => {
        releaseInitial = resolve
      })
    }
    return new Response(
      JSON.stringify(url === '/api/goals' && created ? [detail] : []),
    )
  })
  vi.stubGlobal('fetch', fetch)
  wrap(<Goals accounts={[]} />)
  const add = screen.getByRole('button', { name: 'Add goal' })
  expect(add).toBeDisabled()
  releaseInitial(new Response('[]'))
  await waitFor(() => expect(add).toBeEnabled())
  await userEvent.click(add)
  await userEvent.type(screen.getByLabelText('Goal name'), 'Emergency fund')
  await userEvent.type(screen.getByLabelText('Target'), '20000')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(
    await screen.findByRole('button', { name: 'Emergency fund' }),
  ).toBeVisible()
  expect(
    fetch.mock.calls.some((c) => String(c[0]).includes('/transactions')),
  ).toBe(false)
})

it('exposes functional Net Worth and Goals navigation without changing other sections', async () => {
  const navigate = vi.fn()
  wrap(
    <AppShell page="Overview" navigate={navigate}>
      <p>Workspace</p>
    </AppShell>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
  expect(navigate).toHaveBeenCalledWith('Budget', undefined)
  await userEvent.click(screen.getByRole('button', { name: 'Goals' }))
  expect(navigate).toHaveBeenCalledWith('Goals', undefined)
})

it('keeps projection inputs usable while clearing and typing a new assumption', async () => {
  const detail = {
    goal: {
      id: 'g',
      name: 'Synthetic zero goal',
      mode: 'MANUAL',
      currency: 'BRL',
      target: '0',
      start_date: '2025-01-01',
      deadline: null,
      status: 'ACTIVE',
      notes: '',
    },
    saved: '0',
    allocated: '0',
    remaining: '0',
    warnings: [],
    entries: [],
    progress: '1',
    milestones: [25, 50, 75, 100],
    required_monthly: null,
    projected_completion: '2026-10-19',
    overdue: false,
    history: [],
    projection_method: 'No interest',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/goals'
              ? [detail]
              : url.startsWith('/api/goals/g')
                ? detail
                : [],
          ),
        ),
    ),
  )
  wrap(<Goals accounts={[]} />)
  await userEvent.click(
    await screen.findByRole('button', { name: 'Synthetic zero goal' }),
  )
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100')
  const input = await screen.findByLabelText('Assumed monthly contribution')
  await userEvent.clear(input)
  expect(screen.getByLabelText('Assumed monthly contribution')).toBeVisible()
  await userEvent.type(input, '200')
  await waitFor(() =>
    expect(screen.getByLabelText('Assumed monthly contribution')).toHaveValue(
      '200',
    ),
  )
})

it('keeps funding collapsed by default and exposes existing account allocations on demand', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/goal-allocations'
              ? [
                  {
                    account_id: 'a',
                    name: 'Savings',
                    currency: 'BRL',
                    balance: '48000',
                    allocated: '25000',
                    unallocated: '23000',
                    overallocated: false,
                  },
                ]
              : [],
          ),
        ),
    ),
  )
  wrap(<Goals accounts={[]} />)
  const summary = await screen.findByText('Funding overview', {
    selector: 'summary',
  })
  expect(summary.closest('details')).not.toHaveAttribute('open')
  expect(await screen.findByRole('table', { hidden: true })).not.toBeVisible()
  expect(screen.queryByText('Goal - Status')).toBeNull()
  await userEvent.click(summary)
  expect(
    await screen.findByRole('table', { name: 'Funding overview' }),
  ).toBeVisible()
  expect(screen.getByText('R$48,000.00')).toBeVisible()
  expect(screen.getByText('R$25,000.00')).toBeVisible()
  expect(screen.getByText('R$23,000.00')).toBeVisible()
  await userEvent.click(summary)
  expect(screen.getByRole('table', { hidden: true })).not.toBeVisible()
})

it('distinguishes actual goal progress from reached milestones in goal details', async () => {
  const detail = {
    goal: {
      id: 'progress-goal',
      name: 'Synthetic progress',
      mode: 'ACCOUNT',
      currency: 'BRL',
      target: '20000',
      start_date: '2026-01-01',
      deadline: null,
      status: 'ACTIVE',
      notes: '',
    },
    saved: '9600',
    allocated: '9600',
    remaining: '10400',
    warnings: [],
    entries: [],
    progress: '0.48',
    milestones: [25],
    required_monthly: null,
    projected_completion: null,
    overdue: false,
    history: [],
    projection_method: 'No interest',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/goals'
              ? [detail]
              : url.startsWith('/api/goals/progress-goal')
                ? detail
                : [],
          ),
        ),
    ),
  )
  wrap(<Goals accounts={[]} />)
  expect(
    await screen.findByRole('img', { name: 'Synthetic progress: 48.0%' }),
  ).toBeVisible()
  expect(screen.queryByText('Goal - Status')).toBeNull()
  await userEvent.click(
    screen.getByRole('button', { name: 'Synthetic progress' }),
  )
  await screen.findByRole('heading', {
    name: 'Synthetic progress',
  })
  expect(screen.getByText('Milestones reached: 25.0%')).toBeVisible()
  expect(
    screen.getByRole('progressbar', { name: 'Synthetic progress' }),
  ).toHaveAttribute('aria-valuetext', '48.0%')
})

it('manual position details exclude future and voided observations while retaining their audit rows', async () => {
  const position = {
    id: 'p',
    name: 'Synthetic property',
    kind: 'ASSET',
    category: 'PROPERTY',
    currency: 'BRL',
    liquidity: 'ILLIQUID',
    start_date: '2025-01-01',
    end_date: null,
    acquisition_cost: null,
    disposal_proceeds: null,
    associated_asset_id: null,
    notes: 'Fictional',
    terms: '',
  }
  const observations = [
    {
      id: 'old',
      effective_date: '2026-08-31',
      amount: '100.123456',
      notes: 'Synthetic',
      voided_at: null,
      void_reason: null,
    },
    {
      id: 'void',
      effective_date: '2026-09-01',
      amount: '500',
      notes: 'Synthetic correction',
      voided_at: '2026-09-03',
      void_reason: 'Superseded',
    },
    {
      id: 'future',
      effective_date: '2026-10-01',
      amount: '999999',
      notes: 'Synthetic future observation',
      voided_at: null,
      void_reason: null,
    },
  ]
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/observations')
            ? observations
            : url === '/api/manual-positions'
              ? [position]
              : report,
        ),
      ),
  )
  vi.stubGlobal('fetch', fetch)
  wrap(
    <NetWorthWorkspace navigate={vi.fn()} initialEnd="2026-09-30" />,
    '#/dashboard?view=net-worth&position=p&end=2026-09-30',
  )
  expect(await screen.findByText('R$100.12')).toBeVisible()
  expect(screen.queryByText('R$999,999.00')).not.toBeInTheDocument()
  expect(
    screen.getByText(
      'At least two dated observations are needed to chart history.',
    ),
  ).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Values' }))
  expect(await screen.findByText('2026-10-01')).toBeVisible()
  expect(screen.getByText('Voided: Superseded')).toBeVisible()
  expect(fetch).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ method: 'POST' }),
  )
})
