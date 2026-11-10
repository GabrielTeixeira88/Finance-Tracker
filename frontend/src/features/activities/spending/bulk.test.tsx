import '../../holdings/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { Transaction } from '@/lib/api'
import { TransactionsBulkBar } from './transactions-bulk-bar'
const row: Transaction = {
  id: 'selected',
  account_id: 'a',
  transaction_type: 'EXPENSE',
  direction: 'OUT',
  amount: '32.123456',
  currency: 'BRL',
  transaction_date: '2026-09-01',
  description: 'Fictional selected purchase',
  merchant: null,
  category_id: null,
  payee_id: null,
  payee: null,
  review_status: 'NEEDS_REVIEW',
  transfer_id: null,
  deleted_at: null,
}
it('reviews only explicitly selected IDs through the existing atomic metadata endpoint', async () => {
  const fetch = vi.fn(async (_path: string, _init?: RequestInit) => {
    void _path
    void _init
    return new Response('{}')
  })
  vi.stubGlobal('fetch', fetch)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const saved = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TransactionsBulkBar
        rows={[row]}
        categories={[]}
        onSaved={saved}
        onClear={() => {}}
      />
    </QueryClientProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }))
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply to selected' }),
  )
  await waitFor(() => expect(saved).toHaveBeenCalledOnce())
  expect(fetch.mock.calls).toHaveLength(1)
  const [path, init] = fetch.mock.calls[0]
  expect(path).toBe('/api/transactions/bulk')
  expect(init?.method).toBe('PATCH')
  expect(JSON.parse(String(init?.body))).toEqual({
    transaction_ids: ['selected'],
    changes: { review_status: 'REVIEWED' },
  })
})
it('limits linked transfers to review and does not offer bulk deletion', () => {
  render(
    <TransactionsBulkBar
      rows={[{ ...row, transaction_type: 'TRANSFER', transfer_id: 'linked' }]}
      categories={[]}
      onSaved={() => {}}
      onClear={() => {}}
    />,
  )
  expect(screen.getByRole('button', { name: 'Assign category' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Assign payee' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeEnabled()
  expect(
    screen.queryByRole('button', { name: 'Delete' }),
  ).not.toBeInTheDocument()
})
