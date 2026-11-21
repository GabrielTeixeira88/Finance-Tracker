import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as renderBase, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { allocationSchema } from '@/lib/investment-analytics'
import { PortfolioInsightsOverview } from './portfolio-insights-overview'
import { setPreferences } from '@/lib/preferences'
import { defaultInsightsLayout } from '@/lib/insights-layout'

function render(node: React.ReactNode) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (path: string) =>
        new Response(
          JSON.stringify(
            path.includes('/allocation-targets')
              ? []
              : {
                  as_of: '2026-09-30',
                  rows: [],
                  weight_scope: 'ORIGINAL_CURRENCY_INCLUDING_CASH',
                },
          ),
        ),
    ),
  )
  return renderBase(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      {node}
    </QueryClientProvider>,
  )
}
const member = { account_id: 'fake-account', asset_id: 'fake-rdb' }
const group = {
  name: 'BOND',
  value: '1234.567890',
  weight_percent: '100',
  members: [member],
}
const allocation = allocationSchema.parse({
  currency: 'BRL',
  quality: 'COMPLETE',
  reasons: [],
  known_value: '1234.567890',
  total_value: '1234.567890',
  metadata_policy: '',
  concentration: { '1': '100', '3': '100', '5': '100' },
  summary: {
    cash_value: '0',
    invested_value: '1234.567890',
    cost_basis: '1000',
    unrealized: '234.567890',
    holdings_count: 1,
    accounts_count: 1,
    basis_fx_policy: 'AS_OF',
  },
  rows: [
    {
      ...member,
      security: 'FAKE-RDB',
      symbol: 'FAKE-RDB',
      name: 'Fictional reserve',
      account: 'Fictional brokerage',
      currency: 'BRL',
      value: '1234.567890',
      original_value: '1234.567890',
      instrument_type: 'RDB_CDI',
      asset_class: 'BOND',
      issuer: 'Fictional issuer',
      quantity: '1000',
      price_source: 'SYNTHETIC',
      price_date: '2026-09-30',
    },
  ],
  groups: {
    security: [{ ...group, name: 'FAKE-RDB' }],
    account: [{ ...group, name: 'Fictional brokerage' }],
    asset_class: [group],
    geography: [{ ...group, name: 'Unknown' }],
    sector: [{ ...group, name: 'Unknown' }],
    instrument_type: [{ ...group, name: 'RDB_CDI' }],
  },
})
beforeEach(() => setPreferences({ insightsLayout: defaultInsightsLayout() }))

it('renders authoritative metrics and drills contract classes without turning a Caixinha into cash', async () => {
  const open = vi.fn()
  const { container } = render(
    <PortfolioInsightsOverview data={allocation} onSecurity={open} />,
  )
  expect(
    container.querySelector('[data-widget-id=value] .money'),
  ).toHaveTextContent('R$ 1.234,57')
  expect(
    container.querySelector('[data-widget-id=cash] .money'),
  ).toHaveTextContent('R$ 0,00')
  expect(
    container.querySelector('[data-widget-id=cost_basis] .money'),
  ).toHaveTextContent('R$ 1.000,00')
  expect(
    screen.getByRole('button', { name: 'More info about Top movers' }),
  ).toBeVisible()
  const classes = container.querySelector(
    '[data-widget-id=asset_class]',
  )! as HTMLElement
  // The chart and exact legend share the same real drill-down action.
  await userEvent.click(within(classes).getByText('Exact breakdown'))
  await userEvent.click(
    within(classes.querySelector('.insight-exact')! as HTMLElement).getByRole(
      'button',
      { name: /Fixed Income/ },
    ),
  )
  expect(
    within(classes).getByRole('button', { name: 'Back to classes' }),
  ).toBeInTheDocument()
  await userEvent.click(
    within(classes.querySelector('.insight-exact')! as HTMLElement).getByRole(
      'button',
      { name: /CDI-linked RDB/ },
    ),
  )
  const dialog = screen.getByRole('dialog')
  expect(
    within(dialog).getByText(
      'Fictional simulated prices — not exchange quotes',
    ),
  ).toBeInTheDocument()
  expect(within(dialog).getByText(/Fictional issuer/)).toBeInTheDocument()
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'FAKE-RDB' }),
  )
  expect(open).toHaveBeenCalledWith('fake-rdb')
})

it('keeps missing holdings in details and suppresses complete allocation graphics', async () => {
  const partial = allocationSchema.parse({
    ...allocation,
    quality: 'PARTIAL',
    total_value: null,
    reasons: ['MISSING_PRICE'],
    rows: allocation.rows?.map((row) => ({ ...row, value: null })),
    groups: Object.fromEntries(
      Object.entries(allocation.groups).map(([key, groups]) => [
        key,
        groups.map((group) => ({
          ...group,
          value: null,
          weight_percent: null,
        })),
      ]),
    ),
  })
  const { container } = render(
    <PortfolioInsightsOverview data={partial} onSecurity={vi.fn()} />,
  )
  expect(container.querySelector('.insight-coverage')).toHaveTextContent(
    'Incomplete valuation',
  )
  expect(container.querySelector('.insight-segments')).toBeNull()
  const explorer = container.querySelector('.insight-explorer')! as HTMLElement
  await userEvent.click(
    explorer.querySelector('.insight-breakdown-rows summary')!,
  )
  expect(
    within(explorer).getByRole('button', { name: 'FAKE-RDB' }),
  ).toBeInTheDocument()
  expect(within(explorer).getAllByText('Unavailable').length).toBeGreaterThan(0)
})
