import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import Reconciliation from './reconciliation'
import type { Account } from '@/lib/api'

const account: Account = {
  id: 'a',
  name: 'Synthetic checking',
  type: 'CHECKING',
  currency: 'BRL',
  active: true,
  balance: '5300',
  institution: null,
}
function setup(balance = '0') {
  const statement = {
    id: 's',
    account_id: 'a',
    currency: 'BRL',
    cutoff: '2026-10-31',
    statement_balance: '5300',
    cleared_balance: '5300',
    difference: balance,
    status: 'DRAFT',
    revision: 1,
    notes: 'Synthetic',
    token: 'a'.repeat(64),
    transactions: [],
  }
  const fetch = vi.fn(
    async (path: string, options?: RequestInit) =>
      new Response(
        JSON.stringify(
          options?.method ? {} : path.includes('/sessions') ? [statement] : [],
        ),
      ),
  )
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Reconciliation accounts={[account]} categories={[]} />
    </QueryClientProvider>,
  )
  return { fetch, user: userEvent.setup() }
}
test('reconciliation subviews preserve separate review and bank concepts', async () => {
  const { user } = setup()
  expect(await screen.findByText('No source records yet')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Statements' }))
  expect(await screen.findByText('Cleared balance')).toBeInTheDocument()
  expect(screen.getByLabelText('Statement account')).toHaveValue('a')
  await user.click(screen.getByRole('button', { name: 'Existing duplicates' }))
  expect(
    await screen.findByText(
      'No duplicate suggestions in this comparison window',
    ),
  ).toBeInTheDocument()
})
test('completion requires a reason and sends exact preview token with idempotency key', async () => {
  const { user, fetch } = setup()
  await user.click(screen.getByRole('button', { name: 'Statements' }))
  const button = await screen.findByRole('button', {
    name: 'Complete and lock',
  })
  expect(button).toBeDisabled()
  await user.type(
    screen.getByLabelText('Statement decision reason'),
    'Checked synthetic bank statement',
  )
  await user.click(button)
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/reconciliation/sessions/s',
      expect.objectContaining({ method: 'POST' }),
    ),
  )
  const call = fetch.mock.calls.find(
    ([path, options]) => path.endsWith('/sessions/s') && options?.method,
  )
  expect(JSON.parse(String(call?.[1]?.body))).toEqual(
    expect.objectContaining({
      action: 'COMPLETE',
      token: 'a'.repeat(64),
      request_id: expect.any(String),
    }),
  )
})
test('sub-cent differences cannot be completed even if display rounds to zero', async () => {
  const { user } = setup('0.000001')
  await user.click(screen.getByRole('button', { name: 'Statements' }))
  await screen.findByRole('button', { name: 'Complete and lock' })
  await user.type(
    screen.getByLabelText('Statement decision reason'),
    'Not equal',
  )
  expect(
    screen.getByRole('button', { name: 'Complete and lock' }),
  ).toBeDisabled()
})
