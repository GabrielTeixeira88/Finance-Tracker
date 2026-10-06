import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import { localDate } from './lib/api'

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
    const data = url.startsWith('/api/dashboard')
      ? {
          month: localDate().slice(0, 7),
          totals: [
            {
              currency: 'BRL',
              total_balance: '7800',
              income: '1000',
              expenses: '200',
            },
          ],
          accounts: [account],
          recent_transactions: [],
        }
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
  expect(await screen.findByTestId('Total account value')).toHaveTextContent(
    'R$7,800.00',
  )
  expect(screen.getByTestId('Monthly income')).toHaveTextContent('R$1,000.00')
  expect(screen.getByTestId('Monthly expenses')).toHaveTextContent('R$200.00')
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

it('renders persistent navigation and compact account balances', async () => {
  mockApi()
  renderApp()
  const accountLink = await screen.findByRole('button', {
    name: 'Open Synthetic Checking',
  })
  expect(accountLink).toHaveTextContent('R$5.3K')
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  for (const name of ['Dashboard', 'Transactions', 'Transfers', 'Categories'])
    expect(within(nav).getByRole('button', { name })).toBeInTheDocument()
  await userEvent.click(within(nav).getByRole('button', { name: 'Categories' }))
  expect(
    screen.getByRole('heading', { name: 'Categories', level: 1 }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Open Synthetic Checking' }),
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
  await screen.findByTestId('Monthly income')
  const current = localDate().slice(0, 7)
  await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          url.startsWith('/api/dashboard?month=') && !url.endsWith(current),
      ),
    ).toBe(true),
  )
  expect(fetch.mock.calls.some(([url]) => url.includes('date_from='))).toBe(
    true,
  )
})

it('opens drawer navigation and closes it after choosing a page', async () => {
  mockApi()
  renderApp()
  await screen.findByTestId('Monthly income')
  await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
  const drawer = screen.getByRole('dialog', { name: 'Navigation' })
  await userEvent.click(
    within(drawer).getByRole('button', { name: 'Transfers' }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(
    screen.getByRole('heading', { level: 1, name: 'Transfers' }),
  ).toBeInTheDocument()
})

it('switches theme without persisting any financial records', async () => {
  mockApi()
  renderApp()
  await userEvent.click(
    screen.getByRole('button', { name: 'Switch to dark mode' }),
  )
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(localStorage.getItem('finance-tracker-theme')).toBe('dark')
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
