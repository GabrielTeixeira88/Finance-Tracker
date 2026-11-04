import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import LifeEvents from './life-events'
import { t } from '@/lib/i18n'
import type { EventReport } from '@/lib/life-events'

vi.mock('./wealth', () => ({ WealthChart: () => <div>Daily chart</div> }))
vi.mock('@/components/composition-chart', () => ({
  CompositionChart: () => <div>Category chart</div>,
}))
const fixture: EventReport = {
  event: {
    id: 'event',
    name: 'Fictional holiday',
    description: 'Synthetic only',
    event_type: 'TRAVEL',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    currency: 'BRL',
    color: 'blue',
    icon: 'plane',
    planned_budget: '500',
  },
  as_of: '2026-09-30',
  actual_cost: '180',
  known_cost: '180',
  complete: true,
  missing: [],
  transaction_count: 1,
  linked_ids: ['purchase'],
  remaining: '320',
  categories: [{ id: null, name: 'Uncategorized', value: '180' }],
  daily: [{ date: '2026-09-10', value: '180' }],
  native_totals: [{ currency: 'BRL', value: '180' }],
  transactions: [
    {
      id: 'purchase',
      date: '2026-09-10',
      description: 'Fictional hotel',
      currency: 'BRL',
      amount: '180',
      value: '180',
      refund: false,
      category_id: null,
    },
  ],
}
function mount(rows: EventReport[], candidates: unknown[] = []) {
  window.history.replaceState(
    null,
    '',
    '#/dashboard?view=spending&detail=insights&stage=when&month=2026-09',
  )
  const fetch = vi.fn(
    async (url: string, options?: RequestInit) =>
      new Response(
        JSON.stringify(
          options?.method
            ? {}
            : url.startsWith('/api/transactions')
              ? candidates
              : rows,
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
      <LifeEvents />
    </QueryClientProvider>,
  )
  return fetch
}
it('opens exact ledger details and unlinks metadata without deleting a transaction', async () => {
  const fetch = mount([fixture])
  const user = userEvent.setup()
  await user.click(
    (await screen.findAllByRole('button', { name: /Fictional holiday/ }))[0],
  )
  const dialog = screen.getByRole('region', { name: fixture.event.name })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(within(dialog).getByText('Fictional hotel')).toBeVisible()
  await user.click(
    within(dialog).getByRole('button', { name: t('parity:unlink') }),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/life-events/event/transactions/purchase',
      expect.objectContaining({ method: 'DELETE' }),
    ),
  )
  await user.click(
    within(dialog).getByRole('button', { name: t('parity:close') }),
  )
  expect(
    screen.queryByRole('region', { name: fixture.event.name }),
  ).not.toBeInTheDocument()
})
it('creates a persisted event with exact budget and explicit dates', async () => {
  const fetch = mount([])
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: t('parity:add_event') }),
  )
  await user.type(
    screen.getByLabelText(t('parity:event_name')),
    'Synthetic event',
  )
  fireEvent.change(screen.getByLabelText(t('parity:start')), {
    target: { value: '2026-09-01' },
  })
  fireEvent.change(screen.getByLabelText(t('parity:end')), {
    target: { value: '2026-09-30' },
  })
  await user.type(
    screen.getByLabelText(t('parity:planned_budget')),
    '123.456789',
  )
  await user.click(screen.getByRole('button', { name: t('parity:save') }))
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/life-events',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('123.456789'),
      }),
    ),
  )
})

it('disables purchases linked to another event while leaving unassociated purchases selectable', async () => {
  const other = {
    ...fixture,
    event: { ...fixture.event, id: 'other', name: 'Other fictional event' },
    linked_ids: ['elsewhere'],
  }
  const candidates = ['elsewhere', 'available'].map((id) => ({
    id,
    account_id: 'checking',
    transaction_type: 'EXPENSE',
    direction: 'OUT',
    amount: '12.345678',
    currency: 'BRL',
    transaction_date: '2026-09-10',
    description: id,
    merchant: null,
    category_id: null,
    transfer_id: null,
    deleted_at: null,
  }))
  mount([fixture, other], candidates)
  const user = userEvent.setup()
  await user.click(
    (await screen.findAllByRole('button', { name: /Fictional holiday/ }))[0],
  )
  await user.click(
    screen.getByRole('button', { name: t('parity:link_transactions') }),
  )
  expect(
    await screen.findByRole('checkbox', { name: /elsewhere/ }),
  ).toBeDisabled()
  expect(screen.getByRole('checkbox', { name: /available/ })).toBeEnabled()
})
