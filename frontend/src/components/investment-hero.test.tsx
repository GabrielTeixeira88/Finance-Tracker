import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvestmentHero } from './investment-hero'

vi.mock('./portfolio-value-chart', () => ({
  PortfolioValueChart: ({
    history,
  }: {
    history: { points: { value: string }[] }
  }) => (
    <div data-testid="historical-chart">{history.points.at(-1)?.value}</div>
  ),
}))

function mount(missing = false) {
  window.history.replaceState(null, '', '#/dashboard?view=investments')
  const metric = (value: string | null) => ({
    value,
    method: 'SYNTHETIC_TEST',
    quality: value === null ? 'UNAVAILABLE' : 'COMPLETE',
    reasons: [],
  })
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          start: '2026-06-30',
          end: '2026-09-30',
          currency: 'BRL',
          opening_value: '1000',
          ending_value: missing ? null : '1250.123456',
          net_external_flows: '200',
          absolute_gain: metric('50.123456'),
          twr: metric(missing ? null : '4.123456'),
          xirr: metric(null),
          points: [],
          flows: [],
          benchmark: null,
          valuation: {
            currency: 'BRL',
            fx_provider: 'SYNTHETIC',
            warning: '',
            points: [
              {
                date: '2026-09-30',
                value: missing ? null : '1250.123456',
                known_value: '1250.123456',
                missing_assets: missing ? ['asset'] : [],
                missing_fx: [],
              },
            ],
          },
        }),
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
      <InvestmentHero accountId="synthetic" asOf="2026-09-30" />
    </QueryClientProvider>,
  )
  return fetch
}
it('uses one historical response for exact ending value, chart and period metrics', async () => {
  const fetch = mount()
  expect(await screen.findByText('R$1,250.12')).toBeInTheDocument()
  expect(screen.getByTestId('historical-chart')).toHaveTextContent(
    '1250.123456',
  )
  expect(screen.getByLabelText('R$50.123456 BRL')).toBeInTheDocument()
  expect(fetch.mock.calls).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: '1M' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(window.location.hash).toContain('range=1M')
  expect(fetch).toHaveBeenLastCalledWith(
    expect.stringContaining('start=2026-08-30'),
    expect.anything(),
  )
})
it('keeps missing historical ending value and return unavailable', async () => {
  mount(true)
  expect(await screen.findByText('Unavailable')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('coverage is incomplete')
  expect(screen.queryByText('R$0.00')).not.toBeInTheDocument()
})
