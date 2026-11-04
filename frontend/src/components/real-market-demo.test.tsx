import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DemoContext } from '@/lib/demo-runtime'
import { RealMarketDemo } from './real-market-demo'

afterEach(() => vi.unstubAllGlobals())

it('shows exact API-backed values and explicit unavailable ETF coverage', async () => {
  const fetch = vi.fn(
    async (input: string) =>
      new Response(
        JSON.stringify(
          input.includes('market-evidence')
            ? {
                reference_date: '2026-09-30',
                retrieved_on: '2026-11-03',
                etf_coverage: 'UNAVAILABLE',
                warnings: [
                  'Authorized ETF history is unavailable in this synthetic test.',
                ],
                sources: {},
                caixinha: {
                  principal: '3300.000000',
                  gross_value: '3865.733100',
                  estimated_net: '3763.979855',
                },
                taxes: 'Synthetic test tax policy',
                treasury_fees: 'Synthetic test fee policy',
              }
            : {
                as_of: '2026-09-30',
                currency: 'BRL',
                positions: [],
                tax_policy: '',
                calendar: '',
              },
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
      <DemoContext.Provider
        value={{
          runtime: {
            mode: 'local_demo',
            profile: 'Synthetic test only',
            start_date: '2024-10-01',
            end_date: '2026-09-30',
            generation: 'test',
            scenario: 'real-market-br',
          },
        }}
      >
        <RealMarketDemo />
      </DemoContext.Provider>
    </QueryClientProvider>,
  )
  expect(
    await screen.findByText(/Authorized ETF history is unavailable/),
  ).toBeVisible()
  await userEvent.click(
    screen.getByText('Historical market data and assumptions', {
      selector: 'summary',
    }),
  )
  expect(screen.getByText('R$3,865.73')).toBeVisible()
  expect(screen.getByText('R$3,763.98')).toBeVisible()
  expect(fetch).toHaveBeenCalledWith(
    '/api/demo-control/market-evidence',
    expect.anything(),
  )
})
