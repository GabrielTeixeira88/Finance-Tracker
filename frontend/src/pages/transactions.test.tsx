import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import Transactions from './transactions'
import type { Account, Transaction } from '@/lib/api'

const accounts: Account[] = [
  {
    id: 'a',
    name: 'Checking',
    type: 'CHECKING',
    currency: 'BRL',
    active: true,
    balance: '5300',
    institution: null,
  },
]
const categories = [{ id: 'c', name: 'Transportation' }]
const row: Transaction = {
  id: 't1',
  account_id: 'a',
  transaction_type: 'EXPENSE',
  direction: 'OUT',
  amount: '35.123456',
  currency: 'BRL',
  transaction_date: '2026-10-01',
  description: 'UBER *TRIP HELP.UBER.COM',
  merchant: null,
  category_id: 'c',
  payee_id: 'p',
  payee: { id: 'p', name: 'Uber' },
  review_status: 'NEEDS_REVIEW',
  transfer_id: null,
  deleted_at: null,
}

function setup(
  initial: Transaction[] = [row],
  total = initial.length,
  failWrite = false,
) {
  let rows = initial.map((value) => ({ ...value }))
  const fetch = vi.fn(async (path: string, options?: RequestInit) => {
    if (options?.method) {
      if (failWrite)
        return new Response(JSON.stringify({ detail: 'Synthetic conflict' }), {
          status: 409,
        })
      const data = JSON.parse(String(options.body))
      if (path === '/api/transactions/bulk')
        rows = rows.map((value) =>
          data.transaction_ids.includes(value.id)
            ? { ...value, ...data.changes }
            : value,
        )
      if (path === '/api/payees')
        return new Response(JSON.stringify({ id: 'new', name: data.name }))
      if (path.startsWith('/api/payees/'))
        return new Response(JSON.stringify({ id: 'p', name: data.name }))
      return new Response('{}')
    }
    if (path.startsWith('/api/payees'))
      return new Response(JSON.stringify([{ id: 'p', name: 'Uber' }]))
    return new Response(JSON.stringify(rows), {
      headers: { 'X-Total-Count': String(total) },
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
      <Transactions accounts={accounts} categories={categories} />
    </QueryClientProvider>,
  )
  return fetch
}

it('shows normalized payees, preserved raw descriptions, review state and exact signed amounts', async () => {
  setup()
  const entry = await screen.findByRole('row', { name: /UBER \*TRIP/ })
  expect(within(entry).getByText('Uber')).toBeInTheDocument()
  expect(
    within(entry).getByText('UBER *TRIP HELP.UBER.COM'),
  ).toBeInTheDocument()
  expect(within(entry).getByText('Needs review')).toBeInTheDocument()
  expect(within(entry).getByText('−R$35.123456')).toHaveClass('negative')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
})

it('combines backend search, filters, exact amount ranges and date sorting', async () => {
  const fetch = setup()
  await screen.findByText('Uber')
  await userEvent.type(screen.getByLabelText('Search transactions'), 'Uber')
  await userEvent.selectOptions(screen.getByLabelText('Filter account'), 'a')
  await userEvent.selectOptions(screen.getByLabelText('Filter category'), 'c')
  await userEvent.selectOptions(screen.getByLabelText('Filter type'), 'EXPENSE')
  await userEvent.click(
    screen.getByText('More filters - dates, review, bank status and amount'),
  )
  await userEvent.selectOptions(
    screen.getByLabelText('Filter review'),
    'NEEDS_REVIEW',
  )
  await userEvent.type(screen.getByLabelText('Minimum amount'), '0.123456')
  await userEvent.type(
    screen.getByLabelText('Maximum amount'),
    '9007199254740993.123456',
  )
  await userEvent.type(screen.getByLabelText('From date'), '2026-10-01')
  await userEvent.type(screen.getByLabelText('To date'), '2026-10-31')
  await userEvent.selectOptions(
    screen.getByLabelText('Sort transactions'),
    'date_asc',
  )
  await waitFor(() => {
    const query = new URL(fetch.mock.calls.at(-1)![0], 'http://local')
      .searchParams
    expect(Object.fromEntries(query)).toMatchObject({
      search: 'Uber',
      account_id: 'a',
      category_id: 'c',
      transaction_type: 'EXPENSE',
      review_status: 'NEEDS_REVIEW',
      amount_min: '0.123456',
      amount_max: '9007199254740993.123456',
      date_from: '2026-10-01',
      date_to: '2026-10-31',
      sort: 'date_asc',
      offset: '0',
    })
  })
})

it('paginates using server counts and clears selection on page/filter changes', async () => {
  const fetch = setup([row], 51)
  await userEvent.click(await screen.findByLabelText('Select Uber'))
  expect(screen.getByText('1 selected on this page')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() =>
    expect(fetch.mock.calls.some(([path]) => path.includes('offset=50'))).toBe(
      true,
    ),
  )
  expect(screen.queryByText('1 selected on this page')).not.toBeInTheDocument()
  await screen.findByText(/Page 2/)
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  await userEvent.click(
    screen.getByText('More filters - dates, review, bank status and amount'),
  )
  await userEvent.selectOptions(
    screen.getByLabelText('Filter review'),
    'REVIEWED',
  )
  await screen.findByText(/Page 1/)
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
})

it('bulk reviews only selected IDs, confirms scope, and refreshes the list', async () => {
  const fetch = setup([
    row,
    {
      ...row,
      id: 't2',
      description: 'Other raw description',
      payee_id: null,
      payee: null,
    },
  ])
  await userEvent.click(await screen.findByLabelText('Select Uber'))
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply to selected' }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([path, options]) =>
          path === '/api/transactions/bulk' && options?.method === 'PATCH',
      ),
    ).toBe(true),
  )
  const call = fetch.mock.calls.find(
    ([path]) => path === '/api/transactions/bulk',
  )!
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    transaction_ids: ['t1'],
    changes: { review_status: 'REVIEWED' },
  })
  expect(window.confirm).toHaveBeenCalledWith(
    expect.stringContaining('1 selected'),
  )
  await waitFor(() =>
    expect(
      screen.queryByText('1 selected on this page'),
    ).not.toBeInTheDocument(),
  )
  expect(
    within(screen.getByRole('row', { name: /UBER \*TRIP/ })).getByText(
      'Reviewed',
    ),
  ).toBeInTheDocument()
})

it.each(['category', 'payee'])(
  'assigns a %s in bulk without sending financial fields',
  async (action) => {
    const fetch = setup()
    await userEvent.click(await screen.findByLabelText('Select Uber'))
    await userEvent.selectOptions(screen.getByLabelText('Bulk action'), action)
    if (action === 'category')
      await userEvent.selectOptions(
        screen.getByLabelText('Assign category'),
        'c',
      )
    else {
      await userEvent.type(screen.getByLabelText('Search payees'), 'Uber')
      await screen.findByRole('option', { name: 'Uber' })
      await userEvent.selectOptions(screen.getByLabelText('Payee'), 'p')
    }
    await userEvent.click(
      screen.getByRole('button', { name: 'Apply to selected' }),
    )
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([path]) => path === '/api/transactions/bulk'),
      ).toBe(true),
    )
    expect(
      JSON.parse(
        String(
          fetch.mock.calls.find(
            ([path]) => path === '/api/transactions/bulk',
          )![1]?.body,
        ),
      ),
    ).toEqual({
      transaction_ids: ['t1'],
      changes: { [`${action}_id`]: action === 'category' ? 'c' : 'p' },
    })
  },
)

it('preserves selection and displays failure after a rejected bulk update', async () => {
  setup([row], 1, true)
  await userEvent.click(await screen.findByLabelText('Select Uber'))
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply to selected' }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Synthetic conflict',
  )
  expect(screen.getByLabelText('Select Uber')).toBeChecked()
  expect(screen.getByText('1 selected on this page')).toBeInTheDocument()
})

it('keeps transfer amounts neutral and limits edits/bulk actions to linked review', async () => {
  const fetch = setup([
    {
      ...row,
      transaction_type: 'TRANSFER',
      description: 'Savings transfer',
      transfer_id: 'linked',
      direction: 'OUT',
      category_id: null,
      payee: null,
      payee_id: null,
    },
  ])
  await screen.findByText('Savings transfer')
  expect(screen.getByText('R$35.123456')).toHaveClass('neutral')
  await userEvent.click(screen.getByLabelText('Select Savings transfer'))
  expect(screen.getByRole('option', { name: 'Assign category' })).toBeDisabled()
  expect(screen.getByRole('option', { name: 'Assign payee' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Review' }))
  expect(
    screen.getByText(/Review changes apply to both sides/),
  ).toBeInTheDocument()
  expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument()
  await userEvent.selectOptions(
    screen.getByLabelText('Review status'),
    'REVIEWED',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save review' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([path, options]) =>
          path === '/api/transactions/t1' && options?.method === 'PATCH',
      ),
    ).toBe(true),
  )
  expect(
    JSON.parse(
      String(
        fetch.mock.calls.find(([path]) => path === '/api/transactions/t1')![1]
          ?.body,
      ),
    ),
  ).toEqual({ review_status: 'REVIEWED' })
})

it('edits payee/category/review while preserving the original description and exact amount', async () => {
  const fetch = setup()
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  expect(screen.getByLabelText('Description')).toHaveValue(row.description)
  expect(screen.getByLabelText('Payee')).toHaveValue('p')
  await userEvent.selectOptions(
    screen.getByLabelText('Review status'),
    'REVIEWED',
  )
  await userEvent.selectOptions(screen.getByLabelText('Category'), '')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([, options]) => options?.method === 'PATCH'),
    ).toBe(true),
  )
  const payload = JSON.parse(
    String(
      fetch.mock.calls.find(([, options]) => options?.method === 'PATCH')![1]
        ?.body,
    ),
  )
  expect(payload).not.toHaveProperty('amount')
  expect(payload).not.toHaveProperty('transaction_type')
  expect(payload).toMatchObject({
    category_id: null,
    review_status: 'REVIEWED',
  })
  expect(payload).not.toHaveProperty('description')
  expect(payload).not.toHaveProperty('payee_id')
})

it('creates and renames a payee with explicit global rename confirmation', async () => {
  const fetch = setup()
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  await userEvent.click(screen.getByText('Create or rename a payee'))
  await userEvent.type(screen.getByLabelText('Payee name'), 'Uber Local')
  await userEvent.click(
    screen.getByRole('button', { name: 'Rename selected payee' }),
  )
  await screen.findByText('Payee renamed for all associated transactions.')
  expect(screen.getByLabelText('Description')).toHaveValue(row.description)
  expect(
    fetch.mock.calls.some(
      ([path, options]) =>
        path === '/api/payees/p' && options?.method === 'PATCH',
    ),
  ).toBe(true)
  await userEvent.type(
    screen.getByLabelText('Payee name'),
    'Synthetic new payee',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Create payee' }))
  await screen.findByText(
    'Payee created. Save the transaction to associate it.',
  )
  expect(screen.getByLabelText('Payee')).toHaveValue('new')
  expect(
    fetch.mock.calls.some(
      ([path, options]) => path === '/api/payees' && options?.method === 'POST',
    ),
  ).toBe(true)
})

it('retains ordinary financial correction through the existing PUT service', async () => {
  const fetch = setup()
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  await userEvent.clear(screen.getByLabelText('Amount'))
  await userEvent.type(screen.getByLabelText('Amount'), '36.123456')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([, options]) => options?.method === 'PUT'),
    ).toBe(true),
  )
  expect(
    JSON.parse(
      String(
        fetch.mock.calls.find(([, options]) => options?.method === 'PUT')![1]
          ?.body,
      ),
    ),
  ).toMatchObject({
    amount: '36.123456',
    transaction_type: 'EXPENSE',
    payee_id: 'p',
  })
})

it('keeps bulk payee creation selected across query invalidation', async () => {
  const fetch = setup()
  await userEvent.click(await screen.findByLabelText('Select Uber'))
  await userEvent.selectOptions(screen.getByLabelText('Bulk action'), 'payee')
  await userEvent.click(screen.getByText('Create or rename a payee'))
  await userEvent.type(
    screen.getByLabelText('Payee name'),
    'Synthetic bulk payee',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Create payee' }))
  await screen.findByText(
    'Payee created. Save the transaction to associate it.',
  )
  expect(screen.getByLabelText('Bulk action')).toHaveValue('payee')
  expect(screen.getByLabelText('Payee')).toHaveValue('new')
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply to selected' }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([path]) => path === '/api/transactions/bulk'),
    ).toBe(true),
  )
  expect(
    JSON.parse(
      String(
        fetch.mock.calls.find(([path]) => path === '/api/transactions/bulk')![1]
          ?.body,
      ),
    ),
  ).toEqual({ transaction_ids: ['t1'], changes: { payee_id: 'new' } })
})

it('does not send a bulk update when confirmation is cancelled', async () => {
  const fetch = setup()
  vi.mocked(window.confirm).mockReturnValue(false)
  await userEvent.click(await screen.findByLabelText('Select Uber'))
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply to selected' }),
  )
  expect(
    fetch.mock.calls.some(([, options]) => options?.method === 'PATCH'),
  ).toBe(false)
  expect(screen.getByLabelText('Select Uber')).toBeChecked()
})
it('creates a classification rule draft from raw description without posting money', async () => {
  const fetch = setup()
  await screen.findByText('Uber')
  await userEvent.click(screen.getByRole('button', { name: 'Create rule' }))
  expect(screen.getByLabelText('Description contains')).toHaveValue(
    row.description,
  )
  expect(screen.getByLabelText('Set category')).toHaveValue('c')
  expect(fetch.mock.calls.some(([, init]) => init?.method)).toBe(false)
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByLabelText('Rule name')).not.toBeInTheDocument()
})
