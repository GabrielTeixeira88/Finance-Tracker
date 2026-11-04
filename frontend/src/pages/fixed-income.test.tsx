import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import FixedIncome from './fixed-income'
import { t } from '@/lib/i18n'

vi.mock('@/components/fixed-income-chart', () => ({
  FixedIncomeChart: () => <div>Historical fixture chart</div>,
}))
vi.mock('@/components/composition-chart', () => ({
  CompositionChart: () => <div>Composition</div>,
}))
const position = {
  contract: {
    id: 'fictional-contract',
    asset_id: 'asset',
    account_id: 'account',
    currency: 'BRL',
    instrument_type: 'CDB_CDI',
    issuer: 'Fictional Bank',
    settlement_date: '2026-01-05',
    maturity_date: '2027-01-05',
    redemption_from: '2026-01-05',
    liquidity: 'DAILY',
    index_name: 'CDI',
    index_source: 'SYNTHETIC',
    cdi_percent: '110',
    annual_rate: '0',
    spread_rate: '0',
    acquisition_price: '1',
    fictional: true,
    fgc_eligible: true,
    notes: '',
  },
  name: 'Synthetic CDB',
  quantity: '8000',
  principal: '8000',
  gross_value: '8100.12',
  gross_interest: '100.12',
  income_tax: '22.527',
  iof: '0',
  tax_rate: '22.5',
  estimated_net: '8077.593',
  realized_net: '0',
  status: 'ACTIVE',
  redemption_available: true,
  quality: 'COMPLETE',
  valuation_source: 'SYNTHETIC',
  price_date: '2026-01-08',
}
function mount(row = position) {
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/preview')
            ? {
                principal: '100',
                gross_value: '101',
                gross_interest: '1',
                income_tax: '0.225',
                iof: '0',
                fees: '0',
                cash_proceeds: '100.775',
              }
            : url.endsWith('/redemptions')
              ? {}
              : url.includes('/history?')
                ? {
                    currency: 'BRL',
                    source: 'SYNTHETIC',
                    fictional: true,
                    points: [],
                  }
                : { as_of: '2026-01-08', currency: 'BRL', positions: [row] },
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
      <FixedIncome asOf="2026-01-08" accountId="" />
    </QueryClientProvider>,
  )
  return fetch
}

it('renders API amounts and keeps preview separate from explicit redemption confirmation', async () => {
  const fetch = mount()
  expect(await screen.findByText(/8,100.12/)).toBeVisible()
  expect(screen.getAllByText(/110% CDI/)[0]).toBeVisible()
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Synthetic CDB' })[0],
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Record redemption' }),
  )
  const quantity = screen.getByLabelText('Quantity')
  await userEvent.clear(quantity)
  await userEvent.type(quantity, '100')
  await userEvent.click(
    screen.getByRole('button', { name: 'Preview redemption' }),
  )
  const confirm = await screen.findByRole('button', {
    name: 'Confirm redemption',
  })
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/redemptions'))).toBe(
    false,
  )
  await userEvent.click(confirm)
  await waitFor(() =>
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith('/redemptions')),
    ).toHaveLength(1),
  )
  expect(fetch).toHaveBeenCalledWith(
    '/api/investments/fixed-income/fictional-contract/redemptions',
    expect.objectContaining({
      body: expect.stringContaining('"quantity":"100"'),
    }),
  )
})

it('preserves unavailable coverage and correctly encoded locale labels', async () => {
  mount({
    ...position,
    gross_value: null,
    gross_interest: null,
    estimated_net: null,
  } as unknown as typeof position)
  expect((await screen.findAllByText('Unavailable')).length).toBeGreaterThan(0)
  expect(t('fixed_income:terms', { lng: 'pt-BR' })).toBe(
    'Condições e origem dos dados',
  )
  expect(t('fixed_income:settlement', { lng: 'es-419' })).toBe(
    'Fecha de liquidación',
  )
})
