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
import type { BudgetReport } from '@/lib/budget-api'

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
function fixture(): BudgetReport {
  const row = {
    category_id: 'c',
    name: 'Synthetic Groceries',
    target_id: 't',
    group_id: 'g',
    sort_order: 0,
    active: true,
    rollover_enabled: true,
    override: false,
    target: '500',
    carryover: '100',
    available: '600',
    spent: '650.123456',
    remaining: '-50.123456',
    percent: '108.35',
    status: 'Over target',
    previous: '400',
    change: '250.123456',
    change_percent: '62.53',
  }
  return {
    month: '2026-09',
    currency: 'BRL',
    as_of: '2026-10-10',
    date_from: '2026-09-01',
    date_to: '2026-09-30',
    other_currencies: [],
    categories: [row],
    groups: [{ ...row, id: 'g', name: 'Essentials' }],
    summary: {
      target: '500',
      carryover: '100',
      available: '600',
      income: '1000',
      expenses: '650.123456',
      net_flow: '349.876544',
      budgeted_spending: '650.123456',
      unbudgeted_spending: '0',
      remaining: '-50.123456',
      percent: '108.35',
      over_count: 1,
      previous: '400',
      change: '250.123456',
      change_percent: '62.53',
    },
    daily: [{ date: '2026-09-10', amount: '650.123456' }],
    trend: [
      {
        month: '2026-09',
        income: '1000',
        expenses: '650.123456',
        net_flow: '349.876544',
      },
    ],
    payees: [{ id: 'p', name: 'Synthetic Market', spent: '650.123456' }],
    pace: {
      elapsed_days: 30,
      days_in_month: 30,
      elapsed_percent: '100',
      projection: null,
      status: 'closed',
    },
  }
}
function setup(
  options: { empty?: boolean; fail?: boolean; pending?: boolean } = {},
) {
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
  const category = await screen.findByRole('button', {
    name: /Synthetic Groceries/,
  })
  expect(category).toHaveTextContent('R$650.123456')
  await userEvent.click(category)
  expect(navigate).toHaveBeenLastCalledWith({
    currency: 'BRL',
    spending_only: 'true',
    date_from: '2026-09-01',
    date_to: '2026-09-30',
    category_id: 'c',
  })
  await userEvent.click(
    screen.getByRole('button', { name: /2026-09-10.*view transactions/ }),
  )
  expect(navigate).toHaveBeenLastCalledWith({
    currency: 'BRL',
    spending_only: 'true',
    date_from: '2026-09-10',
    date_to: '2026-09-10',
  })
  await userEvent.click(screen.getByRole('button', { name: 'Budgets' }))
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
  await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => url.includes('month=2025-12')),
    ).toBe(true),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Insights' }))
  expect(screen.getByLabelText('Budget month')).toHaveValue('2025-12')
  await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
  expect(screen.getByLabelText('Budget month')).toHaveValue('2026-01')
})
it('saves a month override with exact amount, group order and optional signed rollover', async () => {
  const { fetch } = setup()
  await screen.findByText('Where it went')
  await userEvent.click(screen.getByRole('button', { name: 'Budgets' }))
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
  await userEvent.click(screen.getByRole('button', { name: 'Insights' }))
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
    await screen.findByText('No spending in this month'),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Budgets' }))
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
