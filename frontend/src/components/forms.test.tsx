import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import {
  AccountForm,
  TransactionForm,
  TransferForm,
  TransactionComposer,
} from './forms'
import { type Account, formatMoney, moneyInput } from '@/lib/api'

const accounts: Account[] = [
  {
    id: 'checking',
    name: 'Checking',
    type: 'CHECKING',
    currency: 'BRL',
    institution: null,
    active: true,
    balance: '5000',
  },
  {
    id: 'savings',
    name: 'Savings',
    type: 'SAVINGS',
    currency: 'BRL',
    institution: null,
    active: true,
    balance: '2000',
  },
  {
    id: 'usd',
    name: 'Dollars',
    type: 'CASH',
    currency: 'USD',
    institution: null,
    active: true,
    balance: '0',
  },
]
function wrap(child: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {child}
    </QueryClientProvider>,
  )
}

it('preserves exact decimal strings in account creation', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'))
  vi.stubGlobal('fetch', fetch)
  wrap(<AccountForm onSaved={() => {}} />)
  await userEvent.type(screen.getByLabelText('Account name'), 'Synthetic Cash')
  await userEvent.clear(screen.getByLabelText('Opening balance'))
  await userEvent.type(
    screen.getByLabelText('Opening balance'),
    '9007199254740993.123456',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('Saved.')
  const body = JSON.parse(fetch.mock.calls[0][1].body)
  expect(body.opening_balance).toBe('9007199254740993.123456')
  expect(body.currency).toBe('BRL')
})

it('rejects zero amounts before submitting income or expense', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  wrap(
    <TransactionForm accounts={accounts} categories={[]} onSaved={() => {}} />,
  )
  await userEvent.selectOptions(screen.getByLabelText('Account'), 'checking')
  await userEvent.type(screen.getByLabelText('Amount'), '0')
  await userEvent.type(
    screen.getByLabelText('Description'),
    'Synthetic expense',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'greater than zero',
  )
  expect(fetch).not.toHaveBeenCalled()
})

it('submits income as an exact string and surfaces backend errors', async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ detail: 'This account is inactive' }), {
      status: 409,
    }),
  )
  vi.stubGlobal('fetch', fetch)
  wrap(
    <TransactionForm accounts={accounts} categories={[]} onSaved={() => {}} />,
  )
  await userEvent.selectOptions(screen.getByLabelText('Account'), 'checking')
  await userEvent.selectOptions(screen.getByLabelText('Type'), 'INCOME')
  await userEvent.type(screen.getByLabelText('Amount'), '1000.001')
  await userEvent.type(screen.getByLabelText('Description'), 'Synthetic salary')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('inactive')
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    amount: '1000.001',
    transaction_type: 'INCOME',
    account_id: 'checking',
    currency: 'BRL',
  })
})

it('allows only distinct same-currency destinations and submits one transfer request', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'))
  vi.stubGlobal('fetch', fetch)
  wrap(<TransferForm accounts={accounts} />)
  await userEvent.selectOptions(
    screen.getByLabelText('From account'),
    'checking',
  )
  const destination = screen.getByLabelText('To account')
  expect(
    within(destination).queryByText('Checking (BRL)'),
  ).not.toBeInTheDocument()
  expect(
    within(destination).queryByText('Dollars (USD)'),
  ).not.toBeInTheDocument()
  await userEvent.selectOptions(destination, 'savings')
  await userEvent.type(screen.getByLabelText('Amount'), '500')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('Saved.')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0][0]).toBe('/api/transfers')
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    source_account_id: 'checking',
    destination_account_id: 'savings',
    amount: '500',
  })
})

it('formats large and fractional amounts without floating-point loss', () => {
  expect(formatMoney('9007199254740993.123456', 'USD')).toBe(
    '$9,007,199,254,740,993.123456',
  )
  expect(formatMoney('-100.100000', 'BRL')).toBe('-R$100.10')
  for (const input of ['0', '-1', 'NaN', 'Infinity', '1e3', '0.0000001'])
    expect(moneyInput.safeParse(input).success).toBe(false)
})

for (const kind of ['EXPENSE', 'INCOME', 'TRANSFER'] as const) {
  it(`creates ${kind} through the unified transaction workflow`, async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    const saved = vi.fn()
    wrap(
      <TransactionComposer
        accounts={accounts}
        categories={[]}
        onSaved={saved}
      />,
    )
    await userEvent.selectOptions(
      screen.getByLabelText('Transaction type'),
      kind,
    )
    if (kind === 'TRANSFER') {
      await userEvent.selectOptions(
        screen.getByLabelText('From account'),
        'checking',
      )
      await userEvent.selectOptions(
        screen.getByLabelText('To account'),
        'savings',
      )
    } else {
      await userEvent.selectOptions(
        screen.getByLabelText('Account'),
        'checking',
      )
      await userEvent.type(
        screen.getByLabelText('Description'),
        'Synthetic entry',
      )
    }
    await userEvent.type(screen.getByLabelText('Amount'), '123.456789')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved.')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe(
      kind === 'TRANSFER' ? '/api/transfers' : '/api/transactions',
    )
    const payload = JSON.parse(fetch.mock.calls[0][1].body)
    expect(payload.amount).toBe('123.456789')
    if (kind !== 'TRANSFER') expect(payload.transaction_type).toBe(kind)
    expect(saved).toHaveBeenCalledOnce()
  })
}
