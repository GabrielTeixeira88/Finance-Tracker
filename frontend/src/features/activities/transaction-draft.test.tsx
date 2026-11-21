import '../holdings/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TransactionComposer } from '@/components/forms'
import type { Transaction } from '@/lib/api'
import { setPreferences, resetAppearance } from '@/lib/preferences'

afterEach(() => act(() => resetAppearance()))
it('copies a native spending draft without copying identity or changing exact money', async () => {
  setPreferences({ language: 'pt-BR' })
  const draft: Transaction = {
    id: 'original',
    account_id: 'a',
    transaction_type: 'EXPENSE',
    direction: 'OUT',
    amount: '35.123456',
    currency: 'BRL',
    transaction_date: '2026-09-01',
    description: 'Fictional original raw description',
    merchant: null,
    category_id: null,
    payee_id: null,
    payee: null,
    review_status: 'REVIEWED',
    transfer_id: null,
    deleted_at: null,
  }
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    void path
    return new Response(JSON.stringify(init?.method ? {} : []))
  })
  vi.stubGlobal('fetch', fetch)
  const { container } = render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <TransactionComposer
        native
        initialDraft={draft}
        accounts={[
          {
            id: 'a',
            name: 'Fictional checking',
            type: 'CHECKING',
            currency: 'BRL',
            active: true,
            institution: null,
            balance: '1000',
          },
        ]}
        categories={[]}
        onSaved={() => {}}
      />
    </QueryClientProvider>,
  )
  expect(screen.getByDisplayValue('35,123456')).toHaveAttribute(
    'data-exact-decimal',
    '35.123456',
  )
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([path, init]) =>
          path === '/api/transactions' && init?.method === 'POST',
      ),
    ).toBe(true),
  )
  const [, init] = fetch.mock.calls.find(
    ([path, init]) => path === '/api/transactions' && init?.method === 'POST',
  )!
  const data = JSON.parse(String(init?.body))
  expect(data).toMatchObject({
    amount: '35.123456',
    account_id: 'a',
    currency: 'BRL',
    description: draft.description,
  })
  expect(data).not.toHaveProperty('id')
  expect(data).not.toHaveProperty('transfer_id')
})
