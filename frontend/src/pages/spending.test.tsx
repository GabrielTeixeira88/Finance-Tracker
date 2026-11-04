import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { SpendingWorkspace } from './spending'
import type { Account } from '@/lib/api'
import { budgetFixture as fixture } from '@/test/fixtures/synthetic/budget'

const accounts: Account[] = [
  {
    id: 'a',
    name: 'Synthetic Checking',
    type: 'CHECKING',
    currency: 'BRL',
    active: true,
    balance: '1000',
    institution: null,
  },
]
const categories = [{ id: 'c', name: 'Synthetic Groceries' }]

function setup(
  options: {
    empty?: boolean
    fail?: boolean
    pending?: boolean
    budgetSetup?: boolean
  } = {},
) {
  window.history.replaceState(
    null,
    '',
    '#/dashboard?view=spending&start=2026-09-01&end=2026-09-30' +
      (options.budgetSetup ? '&detail=budget&setup=true' : ''),
  )
  const navigate = vi.fn()
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (options.pending) return new Promise<Response>(() => {})
    if (options.fail)
      return new Response(JSON.stringify({ detail: 'Synthetic unavailable' }), {
        status: 503,
      })
    if (init?.method) return new Response('{}')
    if (path.startsWith('/api/transactions')) return new Response('[]')
    const data = fixture()
    if (path.startsWith('/api/spending/summary'))
      return new Response(
        JSON.stringify({
          income: data.summary.income,
          expenses: data.summary.expenses,
          daily: options.empty ? [] : data.daily,
          categories: options.empty
            ? []
            : data.categories.map((row) => ({
                category_id: row.category_id,
                spent: row.spent,
              })),
        }),
      )
    const month = new URL(path, 'http://local').searchParams.get('month')!
    data.month = month
    data.date_from = `${month}-01`
    data.date_to = `${month}-30`
    if (options.empty) {
      data.categories = []
      data.groups = []
      data.daily = []
      data.payees = []
    }
    return new Response(JSON.stringify(data))
  })
  vi.stubGlobal('fetch', fetch)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={client}>
      <SpendingWorkspace
        accounts={accounts}
        categories={categories}
        onTransactions={navigate}
        initialMonth="2026-09"
      />
    </QueryClientProvider>,
  )
  return { fetch, navigate }
}
it('renders exact spending and drills into categories/days using backend filters', async () => {
  const { navigate } = setup()
  const categories = await screen.findAllByRole('button', {
    name: /Synthetic Groceries/,
  })
  expect(categories).toHaveLength(1)
  const category = categories[0]
  expect(category).toHaveTextContent('R$650.123456')
  await userEvent.click(category)
  expect(navigate).toHaveBeenLastCalledWith({
    currency: 'BRL',
    spending_only: 'true',
    date_from: '2026-09-01',
    date_to: '2026-09-30',
    category_id: 'c',
  })
  await userEvent.click(screen.getByRole('button', { name: /2026-09-10:/ }))
  expect(navigate).toHaveBeenLastCalledWith({
    currency: 'BRL',
    spending_only: 'true',
    date_from: '2026-09-10',
    date_to: '2026-09-10',
  })
  await userEvent.click(screen.getByRole('button', { name: /Manage/ }))
  const row = screen.getByRole('row', { name: /Synthetic Groceries/ })
  expect(row).toHaveTextContent('Over target')
  expect(row).toHaveTextContent('Rollover R$100.00')
})
it('keeps the selected month across views and supports year boundaries', async () => {
  const { fetch } = setup()
  await screen.findByText('Where it went')
  fireEvent.change(screen.getByLabelText('Budget month'), {
    target: { value: '2026-01' },
  })
  await userEvent.click(
    await screen.findByRole('button', { name: 'Previous month' }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => url.includes('month=2025-12')),
    ).toBe(true),
  )
  await userEvent.click(screen.getByRole('button', { name: /Insights/ }))
  await userEvent.click(screen.getByLabelText('Choose dates'))
  expect(screen.getByLabelText('Budget month')).toHaveValue('2025-12')
  await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
  expect(screen.getByLabelText('Budget month')).toHaveValue('2026-01')
})
it('saves a month override with exact amount, group order and optional signed rollover', async () => {
  const { fetch } = setup()
  await screen.findByText('Where it went')
  await userEvent.click(screen.getByRole('button', { name: /Manage/ }))
  await userEvent.click(
    screen.getByRole('button', { name: 'Edit target Synthetic Groceries' }),
  )
  await userEvent.clear(screen.getByLabelText('Target amount (BRL)'))
  await userEvent.type(
    screen.getByLabelText('Target amount (BRL)'),
    '9007199254740993.123456',
  )
  await userEvent.selectOptions(
    screen.getByLabelText('Target applies to'),
    'month',
  )
  await userEvent.click(
    screen.getByLabelText('Carry unused and overspent amounts forward'),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save target' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, init]) =>
          url === '/api/budgets/targets' &&
          JSON.parse(String(init?.body)).amount === '9007199254740993.123456',
      ),
    ).toBe(true),
  )
  const data = JSON.parse(
    String(
      fetch.mock.calls.find(([url]) => url === '/api/budgets/targets')![1]!
        .body,
    ),
  )
  expect(data).toMatchObject({
    scope: 'month',
    month: '2026-09',
    group_id: 'g',
    rollover_enabled: false,
  })
})
it('creates a target, edits a group and confirms copying only targets', async () => {
  const { fetch } = setup()
  await screen.findByText('Where it went')
  await userEvent.click(screen.getByRole('button', { name: /Manage/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Add target' }))
  await userEvent.type(screen.getByLabelText('Target amount (BRL)'), '700')
  await userEvent.click(screen.getByRole('button', { name: 'Save target' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'Target editor' }),
    ).not.toBeInTheDocument(),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Groups' }))
  await userEvent.selectOptions(screen.getByLabelText('Edit group'), 'g')
  await userEvent.clear(screen.getByLabelText('Group name'))
  await userEvent.type(
    screen.getByLabelText('Group name'),
    'Synthetic essential spending',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save group' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, init]) =>
          url === '/api/budgets/groups/g' && init?.method === 'PUT',
      ),
    ).toBe(true),
  )
  await userEvent.click(
    screen.getByLabelText('Replace existing month overrides'),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Copy targets' }))
  expect(window.confirm).toHaveBeenCalled()
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, init]) =>
          url === '/api/budgets/copy-month' &&
          JSON.parse(String(init?.body)).replace_existing,
      ),
    ).toBe(true),
  )
})
it('exposes insights with payee drill-down and exact cash-flow history', async () => {
  const { navigate } = setup()
  await screen.findByText('Where it went')
  await userEvent.click(screen.getByRole('button', { name: /Insights/ }))
  await userEvent.click(screen.getByRole('button', { name: 'What changed' }))
  expect(window.location.hash).toContain('stage=changed')
  const table = screen.getByRole('table')
  expect(within(table).getByText('R$349.876544')).toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', { name: /Synthetic Market/ }),
  )
  expect(navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({ payee_id: 'p', spending_only: 'true' }),
  )
})
it('shows compact useful empty states', async () => {
  setup({ empty: true })
  expect(
    await screen.findByText('No spending in this period'),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Manage/ }))
  expect(screen.getByText('No monthly targets yet')).toBeInTheDocument()
})
it('shows recoverable report errors', async () => {
  setup({ fail: true })
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Synthetic unavailable',
  )
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})
it('shows loading without empty financial values', () => {
  setup({ pending: true })
  expect(screen.getByRole('status')).toHaveTextContent('Calculating spending')
  expect(screen.queryByText('Where it went')).not.toBeInTheDocument()
})

it('exposes exact bar values on keyboard focus and dismisses the tooltip with Escape', async () => {
  setup()
  const day = await screen.findByRole('button', { name: /2026-09-10:/ })
  fireEvent.focus(day)
  expect(screen.getByRole('tooltip')).toHaveTextContent('R$650.123456')
  expect(day).toHaveAttribute('aria-describedby', 'spending-chart-tooltip')
  fireEvent.keyDown(day, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

it('keeps existing target edits one-month scoped even when opened from ongoing budget setup', async () => {
  setup({ budgetSetup: true })
  await userEvent.click(
    await screen.findByRole('button', {
      name: 'Edit target Synthetic Groceries',
    }),
  )
  expect(screen.getByLabelText('Target applies to')).toHaveValue('month')
  await userEvent.click(screen.getByRole('button', { name: 'Close details' }))
  await userEvent.click(screen.getByRole('button', { name: 'Add target' }))
  expect(screen.getByLabelText('Target applies to')).toHaveValue('default')
})

it('filters the spending plan without changing ledger data or losing its route context', async () => {
  const { fetch } = setup()
  await screen.findByText('Where it went')
  await userEvent.click(screen.getByRole('button', { name: /Insights/ }))
  await userEvent.click(
    await screen.findByRole('button', { name: /^Over target/ }),
  )
  expect(window.location.hash).toContain('plan_filter=over')
  const plan = screen.getByRole('table', { name: 'Spending plan' })
  expect(within(plan).getByText('Synthetic Groceries')).toBeVisible()
  expect(within(plan).queryByText('Uncategorized')).not.toBeInTheDocument()
  expect(fetch.mock.calls.every(([, options]) => !options?.method)).toBe(true)
})
