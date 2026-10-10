import { render, screen, within } from '@testing-library/react'
import { TransactionTable } from './transaction-table'
import type { Account, Transaction } from '@/lib/api'

const account: Account = {
  id: 'a',
  name: 'Checking',
  currency: 'BRL',
  type: 'CHECKING',
  active: true,
  institution: null,
  balance: '5300',
}
const row: Transaction = {
  id: '1',
  account_id: 'a',
  transaction_type: 'INCOME',
  direction: 'IN',
  amount: '1000',
  currency: 'BRL',
  transaction_date: '2026-10-05',
  description: 'Salary',
  merchant: null,
  category_id: 'c',
  transfer_id: null,
  deleted_at: null,
  payee_id: null,
  payee: null,
  review_status: 'REVIEWED',
}

it('renders income and expense amounts with consistent signs, semantics and columns', () => {
  render(
    <TransactionTable
      rows={[
        row,
        {
          ...row,
          id: '2',
          transaction_type: 'EXPENSE',
          direction: 'OUT',
          amount: '200',
          description: 'Groceries',
        },
      ]}
      accounts={[account]}
      categories={[{ id: 'c', name: 'Synthetic category' }]}
    />,
  )
  const income = screen.getByRole('row', { name: /Salary/ })
  const expense = screen.getByRole('row', { name: /Groceries/ })
  expect(within(income).getByText('+R$1,000.00')).toHaveClass('positive')
  expect(within(expense).getByText('−R$200.00')).toHaveClass('negative')
  expect(within(income).getByText('Checking')).toBeInTheDocument()
  expect(within(income).getByText('Synthetic category')).toBeInTheDocument()
  expect(
    screen.getAllByRole('columnheader').map((el) => el.textContent),
  ).toEqual([
    'Date',
    'Payee / Description',
    'Category',
    'Account',
    'Type',
    'Status',
    'Amount',
  ])
})

it('renders transfers neutrally with a link identifier and direction, never as expenses', () => {
  render(
    <TransactionTable
      rows={[
        {
          ...row,
          transaction_type: 'TRANSFER',
          direction: 'OUT',
          amount: '500',
          description: 'Moving savings',
          transfer_id: 'synthetic-pair',
        },
      ]}
      accounts={[account]}
      categories={[]}
    />,
  )
  expect(screen.getByText('R$500.00')).toHaveClass('neutral')
  expect(screen.getByText('R$500.00')).not.toHaveClass('negative')
  expect(screen.getByText('transfer')).toBeInTheDocument()
  expect(screen.getByText(/Sent · syntheti/)).toBeInTheDocument()
  expect(screen.queryByText('−R$500.00')).not.toBeInTheDocument()
})
