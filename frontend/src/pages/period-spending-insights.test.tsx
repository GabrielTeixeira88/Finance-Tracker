import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { PeriodSpendingInsights } from './period-spending-insights'

test('compares equal-length periods through the API and retains exact scoped drill-down', async () => {
  window.history.replaceState(
    null,
    '',
    '/#/dashboard?view=spending&detail=insights&stage=changed&start=2026-07-01&end=2026-09-30',
  )
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes('/payees')
            ? [{ id: 'p', name: 'Fictional merchant' }]
            : {
                income: '0',
                expenses: '9007199254740993.123456',
                categories: [
                  { category_id: 'c', spent: '9007199254740993.123456' },
                ],
                payees: [{ payee_id: 'p', spent: '9007199254740993.123456' }],
              },
        ),
      ),
  )
  vi.stubGlobal('fetch', fetch)
  const drill = vi.fn()
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PeriodSpendingInsights
        asOf="2026-09-30"
        currency="BRL"
        categories={[{ id: 'c', name: 'Synthetic category' }]}
        onTransactions={drill}
      />
    </QueryClientProvider>,
  )
  await userEvent.click(
    await screen.findByRole('button', { name: 'Fictional merchant' }),
  )
  expect(drill).toHaveBeenCalledWith({
    currency: 'BRL',
    spending_only: 'true',
    date_from: '2026-07-01',
    date_to: '2026-09-30',
    payee_id: 'p',
  })
  expect(
    screen.getAllByText('R$9,007,199,254,740,993.123456').length,
  ).toBeGreaterThan(0)
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          url.includes('date_from=2026-03-31') &&
          url.includes('date_to=2026-07-01'),
      ),
    ).toBe(true),
  )
})

test('month-to-date compares the same elapsed span of the prior month', async () => {
  window.history.replaceState(
    null,
    '',
    '/#/dashboard?view=spending&detail=insights&start=2026-09-01&end=2026-09-10',
  )
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes('/payees')
            ? []
            : { income: '0', expenses: '0', categories: [], payees: [] },
        ),
      ),
  )
  vi.stubGlobal('fetch', fetch)
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PeriodSpendingInsights
        currency="BRL"
        asOf="2026-09-10"
        categories={[]}
        onTransactions={vi.fn()}
      />
    </QueryClientProvider>,
  )
  await screen.findByText('Same elapsed span last month')
  expect(
    fetch.mock.calls.some(
      ([url]) =>
        url.includes('date_from=2026-08-01') &&
        url.includes('date_to=2026-08-11'),
    ),
  ).toBe(true)
  expect(
    fetch.mock.calls.some(([url]) => url.includes('date_from=2026-08-22')),
  ).toBe(false)
})
