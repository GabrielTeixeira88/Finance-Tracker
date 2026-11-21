import '../../holdings/i18n'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TransactionsFilterBar } from './transactions-filter-bar'

it('chooses a canonical transaction type through the native faceted menu', async () => {
  const change = vi.fn()
  render(
    <TransactionsFilterBar
      filters={{}}
      accounts={[]}
      categories={[]}
      onChange={change}
      onClear={() => {}}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Type' }))
  const option = await screen.findByRole('option', { name: 'Transfer' })
  await userEvent.click(option)
  await waitFor(() =>
    expect(change).toHaveBeenCalledWith('transaction_type', 'TRANSFER'),
  )
})
