import { render, screen } from '@testing-library/react'
import { RecentActivity, PercentageChange } from './financial'

it('keeps both transfer sides neutral in recent activity', () => {
  render(
    <RecentActivity
      accounts={[]}
      categories={[]}
      rows={['IN', 'OUT'].map((direction, i) => ({
        id: String(i),
        account_id: 'a',
        transaction_type: 'TRANSFER',
        direction: direction as 'IN' | 'OUT',
        amount: '500',
        currency: 'BRL',
        transaction_date: '2026-09-04',
        description: 'Synthetic transfer',
        merchant: null,
        category_id: null,
        transfer_id: 'linked',
        deleted_at: null,
      }))}
    />,
  )
  expect(screen.getAllByText('R$500.00')).toHaveLength(2)
  for (const value of screen.getAllByText('R$500.00'))
    expect(value).toHaveClass('neutral')
  expect(screen.getByText(/Transfer in/)).toBeInTheDocument()
  expect(screen.getByText(/Transfer out/)).toBeInTheDocument()
})

it('does not invent a percentage change from a zero or negative baseline', () => {
  render(<PercentageChange amount="800" percentage={null} currency="BRL" />)
  expect(screen.getByText('+R$800.00')).toBeInTheDocument()
  expect(screen.queryByText(/%/)).not.toBeInTheDocument()
})
