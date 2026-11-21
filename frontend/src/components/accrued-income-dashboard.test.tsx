import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { AccruedIncomeDashboard } from './accrued-income-dashboard'

const contract = {
  id: 'fake-contract',
  asset_id: 'fake-asset',
  account_id: 'fake-account',
  currency: 'BRL',
  instrument_type: 'RDB_CDI',
  issuer: 'Fictional issuer',
  settlement_date: '2025-01-02',
  maturity_date: '2027-01-04',
  redemption_from: '2025-01-02',
  liquidity: 'DAILY',
  index_name: 'CDI',
  index_source: 'SYNTHETIC',
  cdi_percent: '100',
  annual_rate: '0',
  spread_rate: '0',
  acquisition_price: '1',
  fictional: true,
  fgc_eligible: true,
  notes: '',
}
const position = {
  contract,
  name: 'Fictional RDB',
  quantity: '1000',
  principal: '1000',
  gross_value: '1100.50',
  gross_interest: '100.50',
  income_tax: '10.05',
  iof: '0',
  tax_rate: '10',
  estimated_net: '1090.45',
  realized_net: '0',
  status: 'ACTIVE',
  redemption_available: true,
  quality: 'COMPLETE',
  valuation_source: 'SYNTHETIC',
  price_date: '2026-09-30',
}

function mount(missing = false) {
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes('/income/accrual?')
            ? {
                start: '2026-01-01',
                end: '2026-09-30',
                currency: 'BRL',
                opening: {
                  date: '2025-12-31',
                  principal: '1000',
                  value: '1000',
                  gross_interest: '0',
                  estimated_net_earnings: '0',
                  income_tax: '0',
                  iof: '0',
                  quality: 'COMPLETE',
                },
                closing: {
                  date: '2026-09-30',
                  principal: '1000',
                  value: missing ? null : '1100.50',
                  gross_interest: missing ? null : '100.50',
                  estimated_net_earnings: missing ? null : '90.45',
                  income_tax: missing ? null : '10.05',
                  iof: missing ? null : '0',
                  quality: missing ? 'PARTIAL' : 'COMPLETE',
                },
                period: {
                  gross: missing ? null : '100.50',
                  estimated_net: missing ? null : '90.45',
                  redeemed_gross: '0',
                  redeemed_net: '0',
                },
                history: {
                  currency: 'BRL',
                  source: 'DERIVED_CONTRACTUAL_ACCRUAL',
                  fictional: true,
                  points: [],
                },
                contracts_count: 1,
                quality: missing ? 'PARTIAL' : 'COMPLETE',
                method: 'EXACT',
                net_policy: 'ESTIMATED',
              }
            : url.includes('/history?')
              ? {
                  currency: 'BRL',
                  source: 'SYNTHETIC',
                  fictional: true,
                  points: [],
                }
              : {
                  as_of: '2026-09-30',
                  currency: 'BRL',
                  positions: [
                    {
                      ...position,
                      ...(missing
                        ? {
                            gross_interest: null,
                            gross_value: null,
                            estimated_net: null,
                            income_tax: null,
                            iof: null,
                          }
                        : {}),
                    },
                    {
                      ...position,
                      contract: {
                        ...contract,
                        id: 'fake-treasury',
                        asset_id: 'fake-treasury-asset',
                        instrument_type: 'TESOURO_SELIC',
                      },
                      name: 'Fictional Treasury',
                      gross_interest: '999',
                    },
                  ],
                },
        ),
      ),
  )
  vi.stubGlobal('fetch', fetch)
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <AccruedIncomeDashboard
        asOf="2026-09-30"
        start="2026-01-01"
        accountId=""
        onSecurity={vi.fn()}
      />
    </QueryClientProvider>,
  )
  return fetch
}
it('keeps Treasury marks out of CDB/RDB earnings and shows existing net-redemption estimates without posting', async () => {
  const fetch = mount()
  const gross = await screen.findByRole('heading', {
    name: 'Gross outstanding earnings',
  })
  expect(within(gross.closest('section')!).getByText('R$ 100,50')).toBeVisible()
  const net = screen.getByRole('heading', { name: 'Estimated net earnings' })
  expect(within(net.closest('section')!).getByText('R$ 90,45')).toBeVisible()
  expect(
    screen.getByRole('heading', { name: 'Tesouro — price-based result' }),
  ).toBeVisible()
  expect(screen.getByText('R$ 999,00')).toBeVisible()
  expect(fetch.mock.calls.every((call) => typeof call[0] === 'string')).toBe(
    true,
  )
})
it('keeps missing current and historical earnings unavailable', async () => {
  mount(true)
  const gross = await screen.findByRole('heading', {
    name: 'Gross outstanding earnings',
  })
  expect(
    within(gross.closest('section')!).getByText('Unavailable'),
  ).toBeVisible()
  expect(
    await screen.findByText(
      'Historical accrual unavailable — required observations are missing',
    ),
  ).toBeVisible()
})
