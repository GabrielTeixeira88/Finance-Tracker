import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { allocationSchema } from '@/lib/investment-analytics'
import { AllocationTargets } from './allocation-targets'
const allocation = allocationSchema.parse({
  currency: 'BRL',
  quality: 'COMPLETE',
  reasons: [],
  total_value: '10000',
  known_value: '10000',
  groups: { asset_class: [] },
  concentration: {},
  metadata_policy: '',
})
function setup() {
  const calls: {
    path: string
    method: string
    data: Record<string, unknown>
  }[] = []
  let targets: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const data = init?.body ? JSON.parse(String(init.body)) : {}
      calls.push({ path, method, data })
      if (path.endsWith('/accounts'))
        return new Response(
          JSON.stringify([
            {
              id: 'fake-account',
              name: 'Fictional brokerage',
              type: 'INVESTMENT',
              currency: 'BRL',
              institution: null,
              active: true,
              balance: '10000',
            },
          ]),
        )
      if (method === 'POST') {
        targets = [
          {
            target: { ...data, id: 'fake-target', version: 1, active: true },
            weights: data.weights,
            account_ids: data.account_ids,
          },
        ]
        return new Response(JSON.stringify(targets[0]), { status: 201 })
      }
      if (path.includes('/drift'))
        return new Response(
          JSON.stringify({
            target_id: 'fake-target',
            as_of: '2026-09-30',
            currency: 'BRL',
            dimension: 'asset_class',
            scope: 'all',
            account_ids: [],
            total_value: '10000',
            known_value: '10000',
            quality: 'COMPLETE',
            out_of_band_count: 0,
            reasons: [],
            limitations: [],
            rows: [],
          }),
        )
      return new Response(JSON.stringify(targets))
    }),
  )
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={client}>
      <AllocationTargets
        data={allocation}
        asOf="2026-09-30"
        accountId=""
        onSecurity={vi.fn()}
      />
    </QueryClientProvider>,
  )
  return calls
}
it('saves exact default BPS without monetary postings and preserves the remaining row on removal', async () => {
  const calls = setup()
  await screen.findByText('No allocation targets yet')
  await userEvent.click(screen.getByRole('button', { name: 'New target' }))
  const dialog = screen.getByRole('dialog', { name: 'New target' })
  await userEvent.type(
    within(dialog).getByLabelText('Target name'),
    'Household plan',
  )
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Remove classification 1' }),
  )
  expect(within(dialog).getByLabelText('Classification 1')).toHaveValue('CASH')
  const weight = within(dialog).getByLabelText('Target (%)')
  await userEvent.clear(weight)
  await userEvent.type(weight, '100')
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Save target' }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  const posted = calls.find((c) => c.method === 'POST')!
  expect(posted.path).toBe('/api/investments/allocation-targets')
  expect(posted.data).toMatchObject({
    currency: 'BRL',
    band_bps: 500,
    relative_factor_bps: 2000,
    weights: [{ category: 'CASH', target_bps: 10000, required: true }],
  })
  expect(
    calls.every(
      (c) => c.method === 'GET' || c.path.endsWith('/allocation-targets'),
    ),
  ).toBe(true)
})
it('keeps a canceled target draft out of persistence', async () => {
  const calls = setup()
  await screen.findByText('No allocation targets yet')
  await userEvent.click(screen.getByRole('button', { name: 'New target' }))
  await userEvent.keyboard('{Escape}')
  expect(calls.some((c) => c.method === 'POST')).toBe(false)
})
