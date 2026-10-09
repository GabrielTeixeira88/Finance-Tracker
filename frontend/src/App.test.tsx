import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import { localDate } from './lib/api'

vi.mock('@/components/balance-chart', () => ({
  BalanceChart: () => <div aria-label="Balance chart" />,
}))
vi.mock('@/components/overview-chart', () => ({
  OverviewChart: () => <div aria-label="Closing balance chart" />,
}))

const account = {
  id: 'a',
  name: 'Synthetic Checking',
  type: 'CHECKING',
  currency: 'BRL',
  institution: null,
  active: true,
  balance: '5300.000000',
}

function renderApp() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <App />
    </QueryClientProvider>,
  )
}

function mockApi() {
  const fetch = vi.fn(async (url: string) => {
    const data = url.startsWith('/api/history')
      ? {
          date_from: '2026-01-01',
          date_to: localDate(),
          series: [
            {
              currency: 'BRL',
              total_balance: '7800',
              income: '1000',
              expenses: '200',
              opening_balance: '7000',
              net_flow: '800',
              change: '800',
              change_percent: '11.43',
              points: [
                { date: '2026-01-01', balance: '7000' },
                { date: localDate(), balance: '7800' },
              ],
              spending: [
                { category_id: null, name: 'Uncategorized', amount: '200' },
              ],
            },
          ],
          accounts: [account],
          recent_transactions: [],
        }
      : url === '/api/demo'
        ? { enabled: false }
        : url === '/api/accounts'
          ? [account]
          : []
    return new Response(JSON.stringify(data))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

it('renders API dashboard balances and separate reporting totals', async () => {
  mockApi()
  renderApp()
  expect(await screen.findByTestId('Total balance')).toHaveTextContent(
    'R$7,800.00',
  )
  expect(screen.getByTestId('Income')).toHaveTextContent('R$1,000.00')
  expect(screen.getByTestId('Expenses')).toHaveTextContent('R$200.00')
  expect(screen.getByTestId('Net cash flow')).toHaveTextContent('R$800.00')
  expect(screen.getByText('R$5,300.00')).toBeInTheDocument()
})

it('sends transaction filters to the API', async () => {
  const fetch = mockApi()
  renderApp()
  await screen.findByRole('button', { name: 'Open Synthetic Checking' })
  await userEvent.click(screen.getByRole('button', { name: 'Transactions' }))
  await userEvent.selectOptions(
    screen.getByLabelText('Filter type'),
    'TRANSFER',
  )
  await screen.findByText('No transactions match this view.')
  expect(
    fetch.mock.calls.some(([url]) => url.includes('transaction_type=TRANSFER')),
  ).toBe(true)
})

it('renders compact product navigation and categories under Settings', async () => {
  mockApi()
  renderApp()
  await screen.findByRole('button', { name: 'Open Synthetic Checking' })
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  for (const name of ['Overview', 'Accounts', 'Transactions', 'Settings'])
    expect(within(nav).getByRole('button', { name })).toBeInTheDocument()
  expect(
    within(nav).queryByRole('button', { name: 'Transfers' }),
  ).not.toBeInTheDocument()
  expect(
    within(nav).queryByRole('button', { name: 'Categories' }),
  ).not.toBeInTheDocument()
  expect(within(nav).queryByText('Synthetic Checking')).not.toBeInTheDocument()
  await userEvent.click(within(nav).getByRole('button', { name: 'Settings' }))
  expect(
    screen.getByRole('heading', { name: 'Settings', level: 1 }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Categories' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Add category' }),
  ).toBeInTheDocument()
})

it('opens account details with a fixed account ledger filter', async () => {
  const fetch = mockApi()
  renderApp()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Open Synthetic Checking' }),
  )
  expect(
    screen.getByRole('heading', { name: 'Synthetic Checking', level: 1 }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Filter account')).toHaveValue('a')
  expect(screen.getByLabelText('Filter account')).toBeDisabled()
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => url.includes('account_id=a'))).toBe(
      true,
    ),
  )
})

it('requests real month-filtered summaries and recent transactions when navigating months', async () => {
  const fetch = mockApi()
  renderApp()
  await screen.findByTestId('Income')
  const current = localDate().slice(0, 7)
  await userEvent.click(
    screen.getByRole('button', { name: 'Overview options' }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          url.startsWith('/api/history?') && !url.includes(`end=${current}`),
      ),
    ).toBe(true),
  )
  await userEvent.click(screen.getByRole('button', { name: '3M' }))
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => url.includes('period=3M'))).toBe(
      true,
    ),
  )
})

it('keeps labeled navigation available in collapsed and expanded sidebar modes', async () => {
  mockApi()
  renderApp()
  await screen.findByTestId('Total balance')
  expect(document.querySelector('.application-shell')).toHaveClass(
    'sidebar-collapsed',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
  expect(document.querySelector('.application-shell')).not.toHaveClass(
    'sidebar-collapsed',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Collapse sidebar' }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Find a page' }))
  const finder = screen.getByRole('dialog', { name: 'Find a page' })
  await userEvent.type(within(finder).getByLabelText('Find a page'), 'settings')
  expect(
    within(finder).queryByRole('button', { name: 'Accounts' }),
  ).not.toBeInTheDocument()
  await userEvent.click(
    within(finder).getByRole('button', { name: 'Settings' }),
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Categories' }),
  ).toBeInTheDocument()
})

it('shows ledger spending and exact chart values without inventing investment metrics', async () => {
  mockApi()
  renderApp()
  await screen.findByTestId('Total balance')
  expect(screen.getByRole('button', { name: '3M' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'View exact chart data' }),
  )
  const table = screen.getByRole('table')
  expect(within(table).getByText('R$7,000.00')).toBeInTheDocument()
  expect(within(table).getByText('R$7,800.00')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Spending' }))
  expect(
    screen.getByRole('heading', { name: 'Spending by category' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Uncategorized')).toBeInTheDocument()
  const views = screen.getByRole('navigation', { name: 'Overview views' })
  await userEvent.click(within(views).getByRole('button', { name: 'Overview' }))
  expect(
    screen.getByRole('button', { name: 'Open Synthetic Checking' }),
  ).toBeInTheDocument()
})

it('opens drawer navigation and closes it after choosing a page', async () => {
  mockApi()
  renderApp()
  await screen.findByTestId('Income')
  await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
  const drawer = screen.getByRole('dialog', { name: 'Navigation' })
  await userEvent.click(
    within(drawer).getByRole('button', { name: 'Transactions' }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(
    screen.getByRole('heading', { level: 1, name: 'Transactions' }),
  ).toBeInTheDocument()
})

it('switches theme without persisting any financial records', async () => {
  mockApi()
  renderApp()
  await userEvent.click(
    screen.getByRole('button', { name: 'Switch to light mode' }),
  )
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(localStorage.getItem('finance-tracker-theme')).toBe('light')
  expect(localStorage.length).toBe(1)
})

it('shows a recoverable workspace error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Network unavailable')),
  )
  renderApp()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})

it('opens transfer creation from the Transactions action', async () => {
  mockApi()
  renderApp()
  await screen.findByTestId('Total balance')
  await userEvent.click(screen.getByRole('button', { name: 'Transactions' }))
  await userEvent.click(
    screen.getByRole('button', { name: '+ Add Transaction' }),
  )
  await userEvent.selectOptions(
    screen.getByLabelText('Transaction type'),
    'TRANSFER',
  )
  expect(screen.getByLabelText('From account')).toBeInTheDocument()
  expect(screen.getByLabelText('To account')).toBeInTheDocument()
  expect(screen.queryByLabelText('Category')).not.toBeInTheDocument()
})

it('labels future sections as previews and never injects a fake portfolio into a real workspace', async () => {
  mockApi()
  renderApp()
  await screen.findByTestId('Total balance')
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  for (const page of [
    'Budget',
    'Investments',
    'Performance',
    'Net Worth',
    'Reports',
  ]) {
    expect(
      within(nav).getByRole('button', { name: `${page} Preview` }),
    ).toBeInTheDocument()
  }
  await userEvent.click(
    within(nav).getByRole('button', { name: 'Investments Preview' }),
  )
  expect(await screen.findByText('Demo workspace required')).toBeInTheDocument()
  expect(screen.queryByText('WRLD11')).not.toBeInTheDocument()
  await userEvent.click(
    within(nav).getByRole('button', { name: 'Net Worth Preview' }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Account breakdown' }),
  ).toBeInTheDocument()
  expect(screen.getByText('R$7,800.00')).toBeInTheDocument()
})
