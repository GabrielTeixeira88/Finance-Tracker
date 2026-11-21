import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { NetWorthWorkspace } from './wealth'
import Goals from './goals'
import { t } from '@/lib/i18n'
import { AppShell } from '@/components/app-shell'
import { positionSchema, observationSchema } from '@/lib/wealth-api'
function manualFixture(value: unknown, observations: unknown[]) {
  const position = positionSchema.parse(value)
  const rows = observations.map((row) => observationSchema.parse(row))
  const last = rows
    .filter((row) => !row.voided_at && row.effective_date <= '2026-09-30')
    .at(-1)
  return {
    id: position.id,
    name: position.name,
    kind: 'vehicle',
    currency: position.currency,
    marketValue: last?.amount ?? null,
    valuationDate: last?.effective_date ?? null,
    unrealizedGain: null,
    unrealizedGainPct: null,
    position,
    observations: rows,
    linkedAssetId: null,
    recordedStartingBalance: null,
    recordedReduction: null,
    paidShare: null,
    netEquity: null,
  }
}

vi.mock('@/components/portfolio-value-chart', () => ({
  PortfolioValueChart: ({
    label,
    history,
  }: {
    label: string
    history?: { points: { date: string; value: string | null }[] }
  }) => (
    <div
      aria-label={label}
      data-points={JSON.stringify(
        history?.points.map(({ date, value }) => ({ date, value })),
      )}
    />
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
  expect(
    await screen.findByRole('heading', { level: 1, name: /220\.000,00/ }),
  ).toBeVisible()
  await userEvent.selectOptions(screen.getByLabelText('Chart series'), 'assets')
  expect(await screen.findByLabelText('Assets')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: '3M' }))
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('start=2026-06-30'),
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
  await userEvent.click(
    screen.getByRole('button', { name: t('wfCommon:layout.more_options') }),
  )
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
  let initial = true,
    created = false
  const detail = goalFixture('new-goal', 'Emergency fund')
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
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
      JSON.stringify(
        url === '/api/goals'
          ? created
            ? [detail]
            : []
          : url.startsWith('/api/goals/new-goal')
            ? detail
            : [],
      ),
    )
  })
  vi.stubGlobal('fetch', fetch)
  wrap(<Goals accounts={[]} />, '#/goals')
  expect(
    screen.queryByRole('link', { name: /New Goal/i }),
  ).not.toBeInTheDocument()
  releaseInitial(new Response('[]'))
  await userEvent.click(await screen.findByRole('link', { name: /New Goal/i }))
  await userEvent.click(
    await screen.findByRole('button', {
      name: new RegExp(t('wfGoals:new.template_custom_save_up_title'), 'i'),
    }),
  )
  const title = screen.getByLabelText(t('wfGoals:new.title_label'))
  await userEvent.clear(title)
  await userEvent.type(title, 'Emergency fund')
  const target = screen.getByRole('textbox', {
    name: t('wfGoals:new.target_amount'),
  })
  await userEvent.clear(target)
  await userEvent.type(target, '20000')
  await userEvent.click(
    screen.getByRole('button', { name: t('wfGoals:new.create_goal') }),
  )
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Emergency fund' }),
  ).toBeVisible()
  expect(fetch.mock.calls.some(([url]) => url.includes('/transactions'))).toBe(
    false,
  )
  expect(
    fetch.mock.calls.filter(
      ([, options]) =>
        options?.method === 'POST' &&
        String(options.body).includes('Emergency fund'),
    ),
  ).toHaveLength(1)
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
  const detail = goalFixture('g', 'Synthetic zero goal')
  detail.goal.target = '0'
  detail.goal.mode = 'MANUAL'
  detail.saved = '0'
  detail.remaining = '0'
  detail.progress = '1'
  const fetch = vi.fn(
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
  )
  vi.stubGlobal('fetch', fetch)
  wrap(<Goals accounts={[]} />, '#/goals?goal=g')
  expect(
    await screen.findByRole('progressbar', {
      name: t('wfGoals:save_up.saved'),
    }),
  ).toHaveAttribute('aria-valuenow', '100')
  await userEvent.click(
    screen.getByRole('button', {
      name: t('wfGoals:save_up.edit_aria', {
        title: t('wfGoals:save_up.savings_inputs'),
      }),
    }),
  )
  const input = screen.getByRole('textbox', {
    name: t('wfGoals:save_up.field_monthly_contribution'),
  })
  await userEvent.clear(input)
  expect(input).toBeVisible()
  await userEvent.type(input, '200')
  expect(input).toHaveValue('200')
  await userEvent.tab()
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => url.includes('/preview'))).toBe(
      true,
    ),
  )
  expect(
    screen.getByRole('textbox', {
      name: t('wfGoals:save_up.field_monthly_contribution'),
    }),
  ).toBeVisible()
})

it('keeps funding collapsed by default and exposes existing account allocations on demand', async () => {
  const detail = goalFixture('funding-goal', 'Funding goal')
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
              : url === '/api/goals'
                ? [detail]
                : url.startsWith('/api/goals/funding-goal')
                  ? detail
                  : [],
          ),
        ),
    ),
  )
  wrap(<Goals accounts={[]} />, '#/goals?goal=funding-goal')
  await screen.findByRole('button', { name: t('wfCommon:details') })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Goal - Status')).toBeNull()
  await userEvent.click(
    screen.getByRole('button', { name: t('wfCommon:details') }),
  )
  expect(
    await screen.findByRole('table', {
      name: t('goalsMigration:sharedSavings'),
    }),
  ).toBeVisible()
  expect(screen.getByText('R$ 48.000,00')).toBeVisible()
  expect(screen.getByText('R$ 25.000,00')).toBeVisible()
  expect(screen.getByText('R$ 23.000,00')).toBeVisible()
  await userEvent.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
})

it('distinguishes actual goal progress from reached milestones in goal details', async () => {
  const detail = goalFixture('progress-goal', 'Synthetic progress')
  detail.saved = '9600'
  detail.remaining = '10400'
  detail.progress = '0.48'
  const data = {
    ...detail,
    milestone_details: [
      {
        percent: 25,
        amount: '5000',
        reached: true,
        first_observed_date: '2026-01-05',
        estimated_date: null,
      },
      {
        percent: 50,
        amount: '10000',
        reached: false,
        first_observed_date: null,
        estimated_date: null,
      },
    ],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/goals'
              ? [data]
              : url.startsWith('/api/goals/progress-goal')
                ? data
                : [],
          ),
        ),
    ),
  )
  wrap(<Goals accounts={[]} />, '#/goals')
  const card = await screen.findByRole('link', { name: /Synthetic progress/ })
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '48')
  expect(screen.queryByText('Goal - Status')).toBeNull()
  await userEvent.click(card)
  await screen.findByRole('heading', { level: 1, name: 'Synthetic progress' })
  expect(
    screen.getByRole('progressbar', { name: t('wfGoals:save_up.saved') }),
  ).toHaveAttribute('aria-valuenow', '48')
  expect(screen.getAllByText('25,00%')).toHaveLength(2)
  expect(screen.getAllByText('R$ 5.000,00')).toHaveLength(2)
  expect(screen.getAllByText(/First recorded/)).toHaveLength(2)
})

function goalFixture(id: string, name: string) {
  return {
    goal: {
      id,
      name,
      mode: 'ACCOUNT',
      currency: 'BRL',
      target: '20000',
      start_date: '2026-01-01',
      deadline: null as string | null,
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
}

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
          url.includes('/workspace/manual-holdings')
            ? {
                as_of: '2026-09-30',
                rows: [manualFixture(position, observations)],
              }
            : url.endsWith('/observations')
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
  expect(await screen.findByText('R$ 100,12')).toBeVisible()
  expect(screen.queryByText('R$ 999.999,00')).not.toBeInTheDocument()
  expect(
    await screen.findByLabelText(t('wfAsset:profile.history')),
  ).toHaveAttribute(
    'data-points',
    JSON.stringify([{ date: '2026-08-31', value: '100.123456' }]),
  )
  await userEvent.click(
    screen.getByRole('button', { name: t('wfAsset:profile.history') }),
  )
  expect(await screen.findByText('2026-10-01')).toBeVisible()
  expect(screen.getByText('Superseded')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
  await waitFor(() => expect(window.location.hash).not.toContain('position='))
  expect(fetch).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ method: 'POST' }),
  )
})

it('renders sparse declining manual observations without appending a zero or forward-filled chart value', async () => {
  const position = {
    id: 'car',
    name: 'Fictional car',
    kind: 'ASSET',
    category: 'VEHICLE',
    currency: 'BRL',
    liquidity: 'ILLIQUID',
    start_date: '2025-01-01',
    end_date: null,
    acquisition_cost: null,
    disposal_proceeds: null,
    associated_asset_id: null,
    notes: '',
    terms: '',
  }
  const observations = [
    {
      id: 'one',
      effective_date: '2025-01-01',
      amount: '50000.123456',
      notes: '',
      voided_at: null,
      void_reason: null,
    },
    {
      id: 'two',
      effective_date: '2026-03-31',
      amount: '40000.654321',
      notes: '',
      voided_at: null,
      void_reason: null,
    },
  ]
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes('/workspace/manual-holdings')
              ? {
                  as_of: '2026-09-30',
                  rows: [manualFixture(position, observations)],
                }
              : url.endsWith('/observations')
                ? observations
                : url === '/api/manual-positions'
                  ? [position]
                  : report,
          ),
        ),
    ),
  )
  wrap(
    <NetWorthWorkspace navigate={vi.fn()} initialEnd="2026-09-30" />,
    '#/dashboard?view=net-worth&position=car&end=2026-09-30',
  )
  expect(
    await screen.findByLabelText(t('wfAsset:profile.history')),
  ).toHaveAttribute(
    'data-points',
    JSON.stringify(
      observations.map((row) => ({
        date: row.effective_date,
        value: row.amount,
      })),
    ),
  )
  expect(screen.getByText('R$ 40.000,65')).toBeVisible()
})
