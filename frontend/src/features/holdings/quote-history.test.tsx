import './i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { QuoteHistory } from './quote-history'
import { formatMoney } from '@/lib/money'

it('shows exact cached closes and source conventions without manufacturing OHLC quotes', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            current: null,
            pricing: {
              mode: 'MANUAL',
              provider: null,
              symbol_override: null,
              blocked_from: null,
              blocked_to: null,
            },
            mapping: null,
            mapping_error: null,
            sync: null,
            observations: [
              {
                id: 'p',
                price_date: '2026-09-01',
                price: '12345678.123456',
                currency: 'BRL',
                source: 'MANUAL',
                price_type: 'RAW_CLOSE',
                fetched_at: null,
              },
            ],
          }),
        ),
    ),
  )
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <QuoteHistory
        asset={{
          id: 'a',
          symbol: 'SIM-TEST',
          name: 'Fictional test security',
          currency: 'BRL',
          exchange: 'SYNTHETIC',
          asset_type: 'ETF',
          isin: null,
        }}
        asOf="2026-09-30"
      />
    </QueryClientProvider>,
  )
  const table = await screen.findByRole('table', {
    name: 'Cached security prices',
  })
  expect(within(table).getByText('2026-09-01')).toBeInTheDocument()
  expect(
    within(table).getByText(formatMoney('12345678.123456', 'BRL')),
  ).toHaveAttribute('data-exact', '12345678.123456')
  expect(within(table).getByText('RAW_CLOSE')).toBeInTheDocument()
  expect(within(table).queryByText('Open')).not.toBeInTheDocument()
})
