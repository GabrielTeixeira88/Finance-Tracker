import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { PayeeSettings } from './payees'

it('searches and renames a normalized payee through metadata endpoints only', async () => {
  let name = 'Synthetic shop'
  const fetch = vi.fn(async (_path: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      name = JSON.parse(String(init.body)).name
      return new Response(JSON.stringify({ id: 'p', name }))
    }
    return new Response(JSON.stringify([{ id: 'p', name }]))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PayeeSettings />
    </QueryClientProvider>,
  )
  await userEvent.click(
    await screen.findByRole('button', { name: 'Rename Synthetic shop' }),
  )
  await userEvent.clear(screen.getByLabelText('Payee name'))
  await userEvent.type(screen.getByLabelText('Payee name'), 'Synthetic market')
  await userEvent.click(screen.getByRole('button', { name: 'Save payee' }))
  await screen.findByRole('button', { name: 'Rename Synthetic market' })
  expect(
    fetch.mock.calls.filter(([, init]) => init?.method).map(([path]) => path),
  ).toEqual(['/api/payees/p'])
  await userEvent.type(screen.getByLabelText('Search payees'), 'market')
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([path]) => path.includes('search=market')),
    ).toBe(true),
  )
})
