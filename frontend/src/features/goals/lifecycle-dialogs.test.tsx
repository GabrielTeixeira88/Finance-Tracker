import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { it, expect, vi } from 'vitest'
import Goals from '@/pages/goals'
import { goalDetailSchema } from '@/lib/wealth-api'
it('opens repeated archive, restore and delete confirmations after the action popover closes', async () => {
  const detail = goalDetailSchema.parse({
    goal: {
      id: 'g',
      name: 'Goal lifecycle',
      mode: 'ACCOUNT',
      currency: 'BRL',
      target: '1000',
      start_date: '2026-01-01',
      deadline: null,
      status: 'ACTIVE',
      notes: '',
    },
    saved: '0',
    allocated: '0',
    remaining: '1000',
    progress: '0',
    warnings: [],
    entries: [],
    milestones: [],
    required_monthly: null,
    projected_completion: null,
    overdue: false,
    history: [],
    projection_method: 'No return',
  })
  let release: (() => void) | undefined
  let delay = true
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/status') && options?.method === 'POST') {
      if (delay) {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        delay = false
      }
      detail.goal.status = JSON.parse(String(options.body)).status
      return new Response(JSON.stringify(detail.goal))
    }
    if (url === '/api/goals/g' && options?.method === 'DELETE') {
      detail.deleted = true
      return new Response(JSON.stringify(detail.goal))
    }
    return new Response(
      JSON.stringify(
        url === '/api/goals'
          ? detail.deleted
            ? []
            : [detail]
          : url.startsWith('/api/goals/g')
            ? detail
            : [],
      ),
    )
  })
  vi.stubGlobal('fetch', fetch)
  window.history.replaceState(null, '', '#/goals?goal=g')
  render(
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
  await screen.findByRole('heading', { level: 1, name: 'Goal lifecycle' })
  for (const action of ['Archived', 'Restore goal', 'Delete goal']) {
    await userEvent.click(screen.getByRole('button', { name: 'More options' }))
    await userEvent.click(await screen.findByRole('button', { name: action }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', {
        name: action === 'Delete goal' ? 'Delete' : 'Confirm',
      }),
    )
    if (action === 'Archived') {
      await waitFor(() => expect(release).toBeDefined())
      expect(screen.getByRole('alertdialog')).toBeVisible()
      expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled()
      release!()
    }
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  }
  expect(await screen.findByText('No goals yet')).toBeVisible()
  expect(fetch.mock.calls.some(([url]) => url.includes('/transactions'))).toBe(
    false,
  )
})
