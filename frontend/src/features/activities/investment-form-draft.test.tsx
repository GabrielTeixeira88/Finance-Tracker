import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ActivityForm } from '@/pages/investment-forms'
import { activitySchema } from '@/lib/investments'
import { resetAppearance, setPreferences } from '@/lib/preferences'

afterEach(() => resetAppearance())
it('copies a draft with localized visible values while submitting original exact decimal strings', async () => {
  setPreferences({ language: 'pt-BR' })
  const draft = activitySchema.parse({
    id: 'old-activity',
    request_id: 'old-request',
    account_id: 'brokerage',
    asset_id: 'security',
    activity_type: 'BUY',
    activity_date: '2026-09-01',
    quantity: '1.123456',
    unit_price: '2.654321',
    gross_amount: '2.982000',
    fees: '0.000001',
    taxes: '0',
    cash_amount: '2.982001',
    direction: 'OUT',
    currency: 'BRL',
    notes: 'Fictional draft',
    voided_at: null,
  })
  const fetch = vi.fn(async (_path: string, _init?: RequestInit) => {
    void _path
    void _init
    return new Response(
      JSON.stringify({
        gross_amount: '2.982000',
        cash_amount: '2.982001',
        direction: 'OUT',
        resulting_quantity: '1.123456',
      }),
    )
  })
  vi.stubGlobal('fetch', fetch)
  const { container } = render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <ActivityForm
        accounts={[
          {
            id: 'brokerage',
            name: 'Fictional brokerage',
            type: 'INVESTMENT',
            currency: 'BRL',
            balance: '1000',
            institution: null,
            active: true,
          },
        ]}
        assets={[
          {
            id: 'security',
            name: 'Fictional security',
            symbol: 'SIM-TEST',
            currency: 'BRL',
            exchange: 'SYNTHETIC',
            asset_type: 'ETF',
            isin: null,
          },
        ]}
        initialAccount="brokerage"
        initialAsset="security"
        draft={draft}
        onSaved={() => {}}
      />
    </QueryClientProvider>,
  )
  expect(screen.getByDisplayValue('1,123456')).toHaveAttribute(
    'data-exact-decimal',
    '1.123456',
  )
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  const [path, init] = fetch.mock.calls[0]
  if (!init) throw new Error('Expected an explicit preview request')
  expect(path).toContain('/investments/activities/preview')
  expect(JSON.parse(String(init.body))).toMatchObject({
    quantity: '1.123456',
    unit_price: '2.654321',
    fees: '0.000001',
    account_id: 'brokerage',
  })
  expect(JSON.parse(String(init.body)).request_id).not.toBe(draft.request_id)
})
