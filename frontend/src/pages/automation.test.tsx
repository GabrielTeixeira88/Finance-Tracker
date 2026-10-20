import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Settings } from './management'
import TransactionWorkspace from './transaction-workspace'
import type { Account } from '@/lib/api'

const accounts: Account[] = [
  {
    id: 'a',
    name: 'Checking',
    type: 'CHECKING',
    currency: 'BRL',
    active: true,
    balance: '5000',
    institution: null,
  },
]
const saved = {
  id: 'r',
  name: 'Synthetic rule',
  enabled: true,
  priority: 10,
  match_mode: 'ALL',
  conditions: [
    { field: 'description', operator: 'contains', value: 'synthetic' },
  ],
  actions: { review_status: 'NEEDS_REVIEW' },
}
const occurrence = {
  schedule_id: 's',
  name: 'Synthetic rent',
  due_date: '2026-10-04',
  amount: '200.000001',
  currency: 'BRL',
  transaction_type: 'EXPENSE',
  account_id: 'a',
  payee_id: null,
  category_id: null,
  frequency: 'MONTHLY',
  amount_is_approximate: true,
  status: 'OVERDUE',
  transaction_id: null,
}

function setup(settings = true) {
  const fetch = vi.fn(async (path: string, options?: RequestInit) => {
    let data: unknown = []
    if (path.endsWith('/preview'))
      data = {
        match_count: 1,
        change_count: 1,
        skipped_fields: 0,
        preview_token: 'a'.repeat(64),
        rows: [],
      }
    else if (path.endsWith('/apply')) data = { applied: 1, skipped_fields: 0 }
    else if (options?.method) data = saved
    else if (path === '/api/rules') data = [saved]
    else if (path === '/api/rule-suggestions')
      data = [
        { ...saved, id: 'suggestion', support_count: 3, status: 'PENDING' },
      ]
    else if (path === '/api/demo') data = { enabled: false }
    else if (path.startsWith('/api/schedules/upcoming'))
      data = {
        date_from: '2026-10-01',
        date_to: '2026-10-31',
        as_of: '2026-10-09',
        occurrences: [occurrence],
        totals: [
          {
            currency: 'BRL',
            income: '0',
            expenses: '200.000001',
            net: '-200.000001',
          },
        ],
      }
    else if (path.endsWith('/candidates'))
      data = {
        candidates: [],
        ambiguous: false,
        date_tolerance_days: 3,
        amount_tolerance: '2',
      }
    return new Response(JSON.stringify(data), {
      headers: { 'X-Total-Count': '0' },
    })
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
      {settings ? (
        <Settings accounts={accounts} categories={[]} />
      ) : (
        <TransactionWorkspace accounts={accounts} categories={[]} />
      )}
    </QueryClientProvider>,
  )
  return fetch
}

it('keeps rules under Settings and requires a preview and confirmation for history', async () => {
  const fetch = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
  await screen.findByRole('heading', { name: 'Transaction rules' })
  expect(
    screen.queryByRole('button', { name: 'Apply previewed changes' }),
  ).not.toBeInTheDocument()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Preview history' }),
  )
  await screen.findByText(/1 matches/)
  expect(fetch.mock.calls.some(([path]) => path.endsWith('/apply'))).toBe(false)
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply previewed changes' }),
  )
  expect(fetch.mock.calls.some(([path]) => path.endsWith('/apply'))).toBe(false)
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply previewed changes' }),
  )
  await screen.findByText('1 transactions changed; 0 fields skipped.')
  expect(
    JSON.parse(
      String(
        fetch.mock.calls.find(([path]) => path.endsWith('/apply'))![1]?.body,
      ),
    ),
  ).toEqual({ preview_token: 'a'.repeat(64) })
})

it('edits a rule using only allowlisted fields and leaves suggestions opt-in', async () => {
  const fetch = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Edit Synthetic rule' }),
  )
  await userEvent.clear(screen.getByLabelText('Rule name'))
  await userEvent.type(screen.getByLabelText('Rule name'), 'Renamed rule')
  await userEvent.click(screen.getByRole('button', { name: 'Save rule' }))
  await waitFor(() =>
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(
      true,
    ),
  )
  const payload = JSON.parse(
    String(
      fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')![1]?.body,
    ),
  )
  expect(payload.name).toBe('Renamed rule')
  expect(payload).not.toHaveProperty('id')
  expect(fetch.mock.calls.some(([path]) => path.endsWith('/accept'))).toBe(
    false,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  await waitFor(() =>
    expect(fetch.mock.calls.some(([path]) => path.endsWith('/dismiss'))).toBe(
      true,
    ),
  )
})

it('provides an explicit accept action for learned suggestions', async () => {
  const fetch = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Accept' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([path]) => path === '/api/rule-suggestions/suggestion/accept',
      ),
    ).toBe(true),
  )
})

it('keeps schedules within Transactions and never posts projections on navigation', async () => {
  const fetch = setup(false)
  await userEvent.click(screen.getByRole('button', { name: 'Scheduled' }))
  const table = await screen.findByRole('table', {
    name: 'Scheduled occurrences',
  })
  expect(within(table).getByText('overdue')).toBeInTheDocument()
  expect(fetch.mock.calls.some(([, init]) => init?.method)).toBe(false)
  await userEvent.click(within(table).getByRole('button', { name: /Inspect/ }))
  await screen.findByText('No matching transactions')
  expect(screen.getByLabelText('Actual amount')).toHaveValue('')
  await userEvent.type(screen.getByLabelText('Actual amount'), '199.123456')
  await userEvent.click(
    screen.getByRole('button', { name: 'Post actual transaction' }),
  )
  await waitFor(() =>
    expect(fetch.mock.calls.some(([path]) => path.endsWith('/post'))).toBe(
      true,
    ),
  )
  expect(
    JSON.parse(
      String(
        fetch.mock.calls.find(([path]) => path.endsWith('/post'))![1]?.body,
      ),
    ),
  ).toEqual({ amount: '199.123456', transaction_date: '2026-10-04' })
  await userEvent.click(screen.getByRole('button', { name: 'All Activity' }))
  expect(
    screen.getByRole('button', { name: '+ Add Transaction' }),
  ).toBeInTheDocument()
})
it('starts a simple rule without exposing advanced controls and preserves them on expansion', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Create rule' }),
  )
  expect(screen.getByLabelText('Description contains')).toBeInTheDocument()
  expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument()
  await userEvent.type(
    screen.getByLabelText('Description contains'),
    'SYNTHETIC SHOP',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Advanced conditions and priority' }),
  )
  expect(screen.getByLabelText('Condition 1 value')).toHaveValue(
    'SYNTHETIC SHOP',
  )
  expect(screen.getByLabelText('Priority')).toHaveValue(100)
})

it('duplicates as a new disabled draft and filters rules without writing', async () => {
  const fetch = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Duplicate' }),
  )
  expect(screen.getByLabelText('Rule name')).toHaveValue(
    'Synthetic rule (copy)',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save rule' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([path, init]) => path === '/api/rules' && init?.method === 'POST',
      ),
    ).toBe(true),
  )
  const call = fetch.mock.calls.find(
    ([path, init]) => path === '/api/rules' && init?.method === 'POST',
  )!
  expect(JSON.parse(String(call[1]?.body))).toMatchObject({
    enabled: false,
    priority: 10,
  })
  expect(JSON.parse(String(call[1]?.body))).not.toHaveProperty('id')
  await userEvent.type(screen.getByLabelText('Search rules'), 'no match')
  expect(screen.getByText('No matching rules')).toBeInTheDocument()
})
