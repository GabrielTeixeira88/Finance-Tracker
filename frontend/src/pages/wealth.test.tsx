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
  await userEvent.click(screen.getByRole('button', { name: 'Net Worth' }))
  expect(navigate).toHaveBeenCalledWith('Net Worth', undefined)
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

it('distinguishes actual goal progress from reached milestones', async () => {
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
        new Response(JSON.stringify(url === '/api/goals' ? [detail] : [])),
    ),
  )
  wrap(<Goals accounts={[]} />)
  expect(await screen.findByText('48% saved')).toBeVisible()
  expect(screen.getByText('Milestones reached: 25%')).toBeVisible()
  expect(
    screen.getByRole('progressbar', { name: 'Synthetic progress progress' }),
  ).toHaveAttribute('aria-valuetext', '48%')
})
