import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import Goals from '@/pages/goals'
const show = () => {
  window.history.replaceState(null, '', '#/goals')
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <Goals accounts={[]} />
    </QueryClientProvider>,
  )
}
it('offers creation in an empty workspace without inventing goals', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]')),
  )
  show()
  expect(await screen.findByText('No goals yet')).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Create Your First Goal' }),
  ).toBeVisible()
  expect(screen.queryByRole('progressbar')).toBeNull()
})
it('shows a retryable error when goal history cannot load', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: 'Unavailable' }), {
          status: 503,
        }),
    ),
  )
  show()
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
})
it('keeps goal summary currencies separate and never adds unlike money', async () => {
  const row = (id: string, currency: string, amount: string) => ({
    goal: {
      id,
      name: 'Goal ' + currency,
      mode: 'MANUAL',
      currency,
      target: amount,
      start_date: '2026-01-01',
      deadline: null,
      status: 'ACTIVE',
      notes: '',
    },
    saved: amount,
    allocated: amount,
    remaining: '0',
    progress: '1',
    warnings: [],
    entries: [],
    milestones: [25, 50, 75, 100],
    required_monthly: null,
    projected_completion: null,
    overdue: false,
    history: [],
    projection_method: 'No return',
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify([row('b', 'BRL', '100'), row('u', 'USD', '200')]),
        ),
    ),
  )
  show()
  await screen.findByRole('link', { name: /Goal BRL/ })
  expect(screen.getAllByText('R$ 100,00').length).toBeGreaterThan(1)
  expect(screen.getAllByText('US$ 200,00').length).toBeGreaterThan(1)
  expect(screen.queryByText(/300,00/)).toBeNull()
})
