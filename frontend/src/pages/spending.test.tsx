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
import {
  editorFixture,
  spendingFixture,
} from '@/test/fixtures/synthetic/spending-workspace'
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
const categories = [
  {
    id: 'c',
    name: 'Synthetic Groceries',
    icon: 'ShoppingCart',
    color: '#5989AB',
  },
]
function setup(
  options: {
    empty?: boolean
    fail?: boolean
    pending?: boolean
    budgetSetup?: boolean
    view?: 'budget' | 'insights'
    stage?: string
    start?: string
    end?: string
  } = {},
) {
  window.history.replaceState(
    null,
    '',
    '#/dashboard?view=spending&start=' +
      (options.start ?? '2026-09-01') +
      '&end=' +
      (options.end ?? '2026-09-30') +
      '&month=2026-09' +
      (options.view ? '&detail=' + options.view : '') +
      (options.budgetSetup ? '&detail=budget&setup=true' : '') +
      (options.stage ? '&stage=' + options.stage : ''),
  )
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (options.pending) return new Promise<Response>(() => {})
    if (options.fail)
      return new Response(JSON.stringify({ detail: 'Synthetic unavailable' }), {
        status: 503,
      })
    if (init?.method) return new Response('{}')
    if (
      path.startsWith('/api/transactions') ||
      path.startsWith('/api/life-events')
    )
      return new Response('[]')
    if (path.startsWith('/api/spending/workspace'))
      return new Response(JSON.stringify(spendingFixture(options.empty)))
    const data = editorFixture(options.empty),
      month =
        new URL(path, 'http://local').searchParams.get('month') ?? '2026-09'
    data.report.month = month
    data.report.date_from = month + '-01'
    data.report.date_to = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)),
      0,
      12,
    )
      .toISOString()
      .slice(0, 10)
    return new Response(
      JSON.stringify(
        path.startsWith('/api/budgets/workspace') ? data : data.report,
      ),
    )
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
        onTransactions={vi.fn()}
        initialMonth="2026-09"
      />
    </QueryClientProvider>,
  )
  return { fetch }
}
async function openTarget() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Expand group' }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Row options' }))
  await userEvent.click(
    await screen.findByRole('menuitem', {
      name: 'Target details & appearance',
    }),
  )
  return screen.findByRole('form', { name: 'Target editor' })
}
it('renders exact source spending rows and uses canonical category/date ledger filters', async () => {
  setup()
  await screen.findByText('Where it went')
  await userEvent.click(screen.getByRole('button', { name: /Essentials/ }))
  const link = screen.getByRole('link', { name: /Synthetic Groceries/ })
  expect(link).toHaveTextContent('R$ 650,12')
  expect(link).toHaveAttribute('href', expect.stringContaining('category_id=c'))
  expect(link).toHaveAttribute(
    'href',
    expect.stringContaining('date_to=2026-09-30'),
  )
  await userEvent.click(screen.getByText('Exact chart values'))
  const day = screen.getByRole('link', { name: '2026-09-10' })
  expect(day).toHaveAttribute(
    'href',
    expect.stringContaining('date_from=2026-09-10'),
  )
  expect(within(day.closest('tr')!).getByText('R$ 650,12')).toBeInTheDocument()
})
it('keeps month context in source controls and crosses year boundaries', async () => {
  const { fetch } = setup({ view: 'budget' })
  const month = await screen.findByLabelText('Select month')
  fireEvent.change(month, { target: { value: '2026-01' } })
  await userEvent.click(
    await screen.findByRole('button', { name: 'Previous month' }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([path]) => path.includes('month=2025-12')),
    ).toBe(true),
  )
  expect(await screen.findByLabelText('Select month')).toHaveValue('2025-12')
  await userEvent.click(
    await screen.findByRole('button', { name: 'Next month' }),
  )
  expect(await screen.findByLabelText('Select month')).toHaveValue('2026-01')
})
it('retains exact advanced month overrides, order, active state and signed-rollover choice', async () => {
  const { fetch } = setup({ view: 'budget' })
  const form = await openTarget()
  await userEvent.clear(within(form).getByLabelText('Target amount (BRL)'))
  await userEvent.type(
    within(form).getByLabelText('Target amount (BRL)'),
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
      fetch.mock.calls.find(([path]) => path === '/api/budgets/targets'),
    ).toBeDefined(),
  )
  const payload = JSON.parse(
    String(
      fetch.mock.calls.find(([path]) => path === '/api/budgets/targets')![1]
        ?.body,
    ),
  )
  expect(payload).toMatchObject({
    amount: '9007199254740993.123456',
    scope: 'month',
    month: '2026-09',
    group_id: 'g',
    rollover_enabled: false,
    active: true,
  })
})
it('creates a target and confirms previous-month copying without posting cash', async () => {
  const { fetch } = setup({ view: 'budget' })
  await userEvent.click(
    await screen.findByRole('button', { name: 'Add target' }),
  )
  await userEvent.type(
    await screen.findByLabelText('Target amount (BRL)'),
    '700',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save target' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'Target editor' }),
    ).not.toBeInTheDocument(),
  )
  await userEvent.click(
    await screen.findByLabelText('Replace existing overrides'),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Copy plan' }))
  expect(window.confirm).toHaveBeenCalled()
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([path, init]) =>
          path === '/api/budgets/copy-month' &&
          JSON.parse(String(init?.body)).replace_existing,
      ),
    ).toBe(true),
  )
  expect(
    fetch.mock.calls.every(
      ([path, init]) => !init?.method || path.startsWith('/api/budgets/'),
    ),
  ).toBe(true)
})
it('edits source group name, appearance and ordering through the existing group API', async () => {
  const { fetch } = setup({ budgetSetup: true })
  await userEvent.click(
    await screen.findByRole('button', { name: 'Edit Essentials' }),
  )
  const dialog = screen.getByRole('dialog')
  await userEvent.clear(within(dialog).getByLabelText('Name'))
  await userEvent.type(
    within(dialog).getByLabelText('Name'),
    'Essential spending',
  )
  fireEvent.change(within(dialog).getByLabelText('Group order'), {
    target: { value: '3' },
  })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.find(([path]) => path === '/api/budgets/groups/g'),
    ).toBeDefined(),
  )
  expect(
    JSON.parse(
      String(
        fetch.mock.calls.find(([path]) => path === '/api/budgets/groups/g')![1]
          ?.body,
      ),
    ),
  ).toMatchObject({ name: 'Essential spending', sort_order: 3 })
})
it('exposes source change tables, exact comparisons and preserved payee drilldown', async () => {
  setup({ view: 'insights', stage: 'changed' })
  await screen.findByRole('heading', { name: /Category details/i })
  const table = screen.getByRole('table')
  expect(within(table).getByText('2026-08-02 — 2026-08-31')).toBeInTheDocument()
  expect(within(table).getByText('R$ 650,12')).toBeInTheDocument()
  expect(within(table).getByText('R$ 400,00')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Payee spending'))
  expect(
    screen.getByRole('link', { name: /Synthetic Market/ }),
  ).toHaveAttribute('href', expect.stringContaining('payee_id=p'))
})
it('shows useful empty states without fake financial content', async () => {
  setup({ empty: true })
  expect(
    await screen.findByText(/No categorized spending/i),
  ).toBeInTheDocument()
})
it('shows recoverable report errors', async () => {
  setup({ fail: true })
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Synthetic unavailable',
  )
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})
it('shows loading without zero financial values', () => {
  setup({ pending: true })
  expect(screen.getByRole('status')).toHaveTextContent('Calculating spending')
  expect(screen.queryByText('Where it went')).not.toBeInTheDocument()
})
it('preserves exact keyboard-accessible chart values and scoped ledger links', async () => {
  setup()
  await screen.findByText('Exact chart values')
  const summary = screen.getByText('Exact chart values')
  summary.focus()
  fireEvent.keyDown(summary, { key: 'Enter' })
  fireEvent.click(summary)
  const link = screen.getByRole('link', { name: '2026-09-10' })
  link.focus()
  expect(link).toHaveFocus()
  expect(link).toHaveAttribute(
    'href',
    expect.stringContaining('date_to=2026-09-10'),
  )
})
it('retains one-month scope for existing advanced edits, and default scope for new setup targets', async () => {
  setup({ budgetSetup: true })
  await openTarget()
  expect(screen.getByLabelText('Target applies to')).toHaveValue('month')
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await userEvent.click(screen.getByRole('button', { name: 'Add target' }))
  expect(await screen.findByLabelText('Target applies to')).toHaveValue(
    'default',
  )
})
it('filters the source spending plan in URL state without a ledger mutation', async () => {
  const { fetch } = setup({ view: 'insights' })
  await userEvent.click(
    await screen.findByRole('button', { name: 'Over target' }),
  )
  expect(window.location.hash).toContain('plan_filter=over')
  const table = screen.getByRole('table')
  expect(within(table).getByText('Synthetic Groceries')).toBeVisible()
  expect(fetch.mock.calls.every(([, init]) => !init?.method)).toBe(true)
})
it('keeps budget comparison amounts and drilldowns on the labeled calendar month for a custom period', async () => {
  setup({ view: 'insights', start: '2026-09-01', end: '2026-09-15' })
  await screen.findByText(/whole-month 2026-09 targets/)
  const table = screen.getByRole('table')
  expect(within(table).getAllByText('R$ 650,12').length).toBeGreaterThan(0)
  await userEvent.click(within(table).getByText('Synthetic Groceries'))
  expect(window.location.hash).toContain('date_from=2026-09-01')
  expect(window.location.hash).toContain('date_to=2026-09-30')
  expect(window.location.hash).toContain('category_id=c')
})
it('renders source signal and stage cards using real spending comparisons', async () => {
  setup()
  expect(await screen.findByText('Worth a look')).toBeInTheDocument()
  expect(screen.getAllByText(/62,53%/).length).toBeGreaterThan(0)
  expect(screen.getByRole('link', { name: /Where I am/ })).toBeInTheDocument()
})
