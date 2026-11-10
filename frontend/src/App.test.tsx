import {
  editorFixture,
  spendingFixture,
} from '@/test/fixtures/synthetic/spending-workspace'
import { defaultSidebarOrder } from '@/lib/sidebar-order'
import { defaultInsightsLayout } from '@/lib/insights-layout'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import { budgetFixture } from '@/test/fixtures/synthetic/budget'
import { act } from '@testing-library/react'
import { navigateTo } from '@/lib/navigation'
import { AppShell } from '@/components/app-shell'
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

it('keeps normal and demo sidebar preferences separate and preserves the legacy normal choice', () => {
  localStorage.setItem('finance-tracker-sidebar', 'expanded')
  document.documentElement.dataset.workspace = 'normal'
  const normal = render(
    <AppShell page="Budget" navigate={vi.fn()}>
      Normal
    </AppShell>,
  )
  expect(document.querySelector('.application-shell')).not.toHaveClass(
    'sidebar-collapsed',
  )
  normal.unmount()
  document.documentElement.dataset.workspace = 'demo'
  const demo = render(
    <AppShell page="Budget" navigate={vi.fn()}>
      Demo
    </AppShell>,
  )
  expect(document.querySelector('.application-shell')).toHaveClass(
    'sidebar-collapsed',
  )
  expect(localStorage.getItem('finance-tracker-sidebar-normal')).toBe(
    'expanded',
  )
  expect(localStorage.getItem('finance-tracker-sidebar-demo')).toBe('collapsed')
  demo.unmount()
  document.documentElement.dataset.workspace = 'normal'
})

function mockApi() {
  const fetch = vi.fn(async (url: string) => {
    if (url.startsWith('/api/accounts/a/workspace'))
      return new Response(
        JSON.stringify({
          account_id: 'a',
          currency: 'BRL',
          start: '2026-01-01',
          end: localDate(),
          cash: account.balance,
          value: account.balance,
          summary: null,
          history: {
            currency: 'BRL',
            fx_provider: 'NONE',
            warning: 'Isolated test ledger',
            points: [
              {
                date: localDate(),
                value: account.balance,
                known_value: account.balance,
                missing_assets: [],
                missing_fx: [],
              },
            ],
          },
        }),
      )
    if (url.startsWith('/api/budgets/workspace')) {
      const data = editorFixture()
      data.report.as_of = localDate()
      return new Response(JSON.stringify(data))
    }
    if (url.startsWith('/api/spending/workspace')) {
      const data = spendingFixture()
      const params = new URL(url, 'http://local').searchParams
      data.start = params.get('date_from')!
      data.end_exclusive = params.get('date_to')!
      data.as_of = localDate()
      data.current = {
        ...data.current,
        income: '1000',
        expenses: '200',
        gross_expenses: '200',
        average_transaction: '200',
        net_flow: '800',
        after_savings: '800',
        change: '0',
        change_percent: null,
      }
      data.categories = [
        {
          category_id: null,
          name: 'Uncategorized',
          current: '200',
          previous: '0',
          change: '200',
          change_percent: null,
          history: [],
        },
      ]
      data.daily = [
        {
          date: data.start,
          income: '1000',
          spending: '200',
          to_savings: '0',
          from_savings: '0',
          net_flow: '800',
          after_savings: '800',
        },
      ]
      return new Response(JSON.stringify(data))
    }
    if (url.startsWith('/api/budgets/monthly'))
      return new Response(
        JSON.stringify({ ...budgetFixture(), as_of: localDate() }),
      )
    if (url.startsWith('/api/spending/summary'))
      return new Response(
        JSON.stringify({
          income: '1000',
          expenses: '200',
          categories: [{ category_id: null, spent: '200' }],
          daily: [{ date: localDate(), amount: '200' }],
        }),
      )
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

it('restores an account ledger bookmark and keeps skip-to-content on that route', async () => {
  const fetch = mockApi()
  window.history.replaceState(
    null,
    '',
    '#/account?account=a&search=Synthetic&amount_min=0.123456',
  )
  renderApp()
  expect(
    await screen.findByLabelText('Search transactions', {}, { timeout: 10000 }),
  ).toHaveValue('Synthetic')
  expect(screen.getByLabelText('Filter account')).toHaveValue('a')
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          url.includes('account_id=a') && url.includes('amount_min=0.123456'),
      ),
    ).toBe(true),
  )
  const before = window.location.hash
  await userEvent.click(screen.getByRole('link', { name: 'Skip to content' }))
  expect(window.location.hash).toBe(before)
  expect(screen.getByRole('main')).toHaveFocus()
})

it('renders API spending totals and keeps account balances in Accounts', async () => {
  mockApi()
  renderApp()
  await screen.findByText('Where it went', {}, { timeout: 10000 })
  const metrics = screen.getByRole('group', { name: 'Cash flow summary' })
  expect(metrics).toHaveTextContent('R$ 1.000,00')
  expect(metrics).toHaveTextContent('R$ 200,00')
  expect(metrics).toHaveTextContent('R$ 800,00')
  await userEvent.click(screen.getByRole('button', { name: 'Accounts' }))
  expect(await screen.findByText('R$ 5.300,00')).toBeInTheDocument()
})

it('sends transaction filters to the API', async () => {
  const fetch = mockApi()
  renderApp()
  await screen.findByText('Where it went', {}, { timeout: 10000 })
  await userEvent.click(screen.getByRole('button', { name: 'Activities' }))
  await userEvent.click(
    await screen.findByRole('button', { name: /^Type$/ }, { timeout: 10000 }),
  )
  await userEvent.click(await screen.findByText('Transfer', { exact: true }))
  await screen.findByText('No transactions match this view.')
  expect(
    fetch.mock.calls.some(([url]) => url.includes('transaction_type=TRANSFER')),
  ).toBe(true)
})

it('renders compact product navigation and categories under Settings', async () => {
  mockApi()
  renderApp()
  await screen.findByText('Where it went', {}, { timeout: 10000 })
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  for (const name of [
    'Dashboard',
    'Accounts',
    'Activities',
    'Holdings',
    'Insights',
    'Goals',
    'Settings',
  ])
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
    await screen.findByRole('heading', { name: 'General', level: 1 }),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Spending' }))
  const categoriesHeading = await screen.findByRole('heading', {
    name: 'Categories',
  })
  await userEvent.click(
    within(categoriesHeading.closest('section')!).getByRole('button', {
      name: 'Manage',
    }),
  )
  expect(
    screen.getByRole('button', { name: 'Add category' }),
  ).toBeInTheDocument()
})

it('opens account details with a fixed account ledger filter', async () => {
  const fetch = mockApi()
  renderApp()
  await screen.findByText('Where it went', {}, { timeout: 10000 })
  await userEvent.click(screen.getByRole('button', { name: 'Accounts' }))
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

it('requests selected-period spending summaries and preserves independent budget navigation', async () => {
  const fetch = mockApi()
  renderApp()
  await screen.findByText('Where it went', {}, { timeout: 10000 })
  await userEvent.click(screen.getByRole('button', { name: 'Last month' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) =>
        url.startsWith('/api/spending/workspace?'),
      ),
    ).toBe(true),
  )
  expect(window.location.hash).toContain('start=')
  const period = new URLSearchParams(window.location.hash.split('?')[1]).get(
    'start',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Previous budget month' }),
  )
  expect(
    new URLSearchParams(window.location.hash.split('?')[1]).get('start'),
  ).toBe(period)
})

it('keeps labeled navigation available in collapsed and expanded sidebar modes', async () => {
  mockApi()
  renderApp()
  await screen.findByText('Where it went', {}, { timeout: 10000 })
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
  expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()
})

it('shows ledger spending and accessible exact daily values without inventing investment metrics', async () => {
  mockApi()
  renderApp()
  await screen.findByText('Where it went', {}, { timeout: 10000 })
  expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await userEvent.click(screen.getByLabelText('Daily spending details'))
  expect(
    within(screen.getByRole('table', { name: 'Daily spending' })).getByText(
      'R$ 200,00',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('Uncategorized')).toBeInTheDocument()
})

it('opens drawer navigation and closes it after choosing a page', async () => {
  mockApi()
  renderApp()
  await screen.findByText('Where it went', {}, { timeout: 10000 })
  await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
  const drawer = screen.getByRole('dialog', { name: 'Navigation' })
  await userEvent.click(
    within(drawer).getByRole('button', { name: 'Activities' }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Transactions' }),
  ).toBeInTheDocument()
})

it('switches theme without persisting any financial records', async () => {
  mockApi()
  renderApp()
  await userEvent.click(
    screen.getByRole('button', { name: 'Switch to light mode' }),
  )
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(
    JSON.parse(localStorage.getItem('finance-tracker-preferences-normal')!),
  ).toEqual({
    insightsLayout: defaultInsightsLayout(),
    sidebarOrder: [...defaultSidebarOrder],
    font: 'mono',
    palette: 'olive',
    mode: 'light',
    language: 'en',
    chartPalette: 'theme',
    financialColors: 'standard',
  })
  expect(localStorage.getItem('finance-tracker-sidebar-normal')).toBe(
    'collapsed',
  )
  expect(Object.keys(localStorage).sort()).toEqual([
    'finance-tracker-preferences-normal',
    'finance-tracker-sidebar-normal',
  ])
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
  await screen.findByText('Where it went', {}, { timeout: 10000 })
  await userEvent.click(screen.getByRole('button', { name: 'Activities' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Add Activities' }),
  )
  await userEvent.click(
    await screen.findByRole('button', { name: 'Add Transaction' }),
  )
  await userEvent.click(await screen.findByTestId('activity-type-transfer'))
  expect(screen.getByLabelText('From account')).toBeInTheDocument()
  expect(screen.getByLabelText('To account')).toBeInTheDocument()
  expect(screen.queryByLabelText('Category')).not.toBeInTheDocument()
})

it('keeps previews out of primary navigation and preserves their bookmarks', async () => {
  mockApi()
  renderApp()
  await screen.findByText('Where it went', {}, { timeout: 10000 })
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  for (const name of [
    'Budget',
    'Investments',
    'Performance',
    'Reports Preview',
  ])
    expect(within(nav).queryByRole('button', { name })).not.toBeInTheDocument()
  expect(screen.queryByText('WRLD11')).not.toBeInTheDocument()
  act(() => navigateTo('Reports'))
  expect(window.location.hash).toContain('view=previews')
  expect(
    await screen.findByRole('heading', { name: 'Account breakdown' }),
  ).toBeInTheDocument()
  expect(screen.getByText('R$ 7.800,00')).toBeInTheDocument()
})
