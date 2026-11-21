import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DemoContext, type DemoRuntime } from '@/lib/demo-runtime'
import { localDate, request, setDemoGeneration } from '@/lib/api'
import {
  DemoExperience,
  DemoScenarios,
  HistoricalDemoFooter,
} from './demo-experience'
import { DemoProvider } from './demo-provider'
import { GmailQueue } from '@/pages/gmail'
import { getGoals } from '@/lib/wealth-api'
import { navigateTo } from '@/lib/navigation'

vi.mock('./real-market-demo', () => ({
  RealMarketDemo: () => <p>Historical portfolio context</p>,
}))

const runtime: DemoRuntime = {
  mode: 'local_demo',
  profile: 'Alex Morgan (fictional)',
  start_date: '2024-10-01',
  end_date: '2026-09-30',
  generation: 'session-one',
}
afterEach(() => {
  setDemoGeneration()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function wrapper(children: React.ReactNode) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  )
}

it('never exposes reset or demo controls in a normal workspace', () => {
  render(wrapper(<DemoExperience />))
  expect(screen.queryByText('Reset demo')).not.toBeInTheDocument()
})

it('offers only the Brazil portfolio without legacy scenario or household actions', async () => {
  navigateTo('Investments')
  render(
    wrapper(
      <DemoContext.Provider
        value={{
          runtime: {
            ...runtime,
            scenario: 'real-market-br',
            scenarios: [
              { id: 'real-market-br', name: 'Real Market Portfolio — Brazil' },
            ],
          },
        }}
      >
        <DemoExperience />
        <HistoricalDemoFooter />
        <DemoScenarios settings />
      </DemoContext.Provider>,
    ),
  )
  await userEvent.click(screen.getByText('Demo', { selector: 'summary' }))
  expect(screen.queryByLabelText('Demo scenario')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Guided tour' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Simulate Gmail notification' }),
  ).not.toBeInTheDocument()
  expect(screen.getByText('Historical portfolio context')).toBeVisible()
})

it('keeps historical context below investment content and excludes household pages', async () => {
  const user = userEvent.setup()
  render(
    wrapper(
      <DemoContext.Provider
        value={{ runtime: { ...runtime, scenario: 'real-market-br' } }}
      >
        <DemoExperience />
        <div>Financial page content</div>
        <HistoricalDemoFooter />
      </DemoContext.Provider>,
    ),
  )
  expect(
    screen.queryByText('Historical portfolio context'),
  ).not.toBeInTheDocument()
  await user.click(screen.getByText('Demo', { selector: 'summary' }))
  expect(screen.getByRole('button', { name: 'Reset demo' })).toBeVisible()
  for (const page of ['Investments', 'Performance'] as const) {
    // Navigate through the same hash/history mechanism as the application shell.
    await act(async () => navigateTo(page))
    expect(screen.getByText('Historical portfolio context')).toBeVisible()
    const footer = screen
      .getByText('Historical portfolio context')
      .closest('footer')!
    expect(
      screen
        .getByText('Financial page content')
        .compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      screen.getByText(/Historical simulation: actual market observations/),
    ).toBeVisible()
  }
  for (const page of [
    'Budget',
    'Accounts',
    'Transactions',
    'Net Worth',
    'Goals',
    'Settings',
  ] as const) {
    await act(async () => navigateTo(page))
    expect(
      screen.queryByText('Historical portfolio context'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Historical simulation: actual market observations/),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Demo', { selector: 'summary' })).toBeVisible()
  }
})

it('shows one complete demo without scenario switching controls', async () => {
  const selectScenario = vi.fn()
  render(
    wrapper(
      <DemoContext.Provider
        value={{
          runtime: {
            ...runtime,
            scenario: 'unified',
            scenarios: [{ id: 'unified', name: 'Complete demo' }],
          },
          selectScenario,
        }}
      >
        <DemoExperience />
      </DemoContext.Provider>,
    ),
  )
  await userEvent.click(screen.getByText('Demo', { selector: 'summary' }))
  expect(screen.queryByLabelText('Demo scenario')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Return to household demo' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reset demo' })).toBeVisible()
  expect(selectScenario).not.toHaveBeenCalled()
})

it('shows a skippable tour and navigates real product sections', async () => {
  const user = userEvent.setup()
  render(
    wrapper(
      <DemoContext.Provider value={{ runtime }}>
        <DemoExperience />
      </DemoContext.Provider>,
    ),
  )
  await user.click(screen.getByText('Demo', { selector: 'summary' }))
  expect(screen.getByText('Fictional local demo')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guided tour' }))
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(window.location.hash).toContain('/activities')
  expect(screen.getByText('Tour 2 / 11')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Skip tour' }))
  expect(screen.queryByText('Tour 2 / 11')).not.toBeInTheDocument()
  expect(screen.getByText('Fictional local demo')).toBeInTheDocument()
})

it('requires explicit reset confirmation and renders failures', async () => {
  const user = userEvent.setup()
  const reset = vi.fn().mockRejectedValue(new Error('Synthetic reset failed'))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(
    wrapper(
      <DemoContext.Provider value={{ runtime, reset }}>
        <DemoExperience />
      </DemoContext.Provider>,
    ),
  )
  await user.click(screen.getByText('Demo', { selector: 'summary' }))
  await user.click(screen.getByRole('button', { name: 'Reset demo' }))
  expect(reset).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  await user.click(screen.getByRole('button', { name: 'Reset demo' }))
  expect(await screen.findByText('Synthetic reset failed')).toBeInTheDocument()
})

it('simulates via the API and routes to review instead of claiming Gmail is connected', async () => {
  const user = userEvent.setup()
  const fetch = vi.fn().mockResolvedValue(new Response('{}'))
  vi.stubGlobal('fetch', fetch)
  render(wrapper(<DemoScenarios settings />))
  expect(screen.getByText(/Gmail is not connected/)).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Simulate Gmail notification' }),
  )
  await waitFor(() => expect(window.location.hash).toContain('tool=gmail'))
  expect(fetch).toHaveBeenCalledWith(
    '/api/demo-control/notification',
    expect.objectContaining({ method: 'POST' }),
  )
})

it('initializes generation headers and the fixed demo date before rendering the app', async () => {
  const fetch = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(runtime))),
    )
  vi.stubGlobal('fetch', fetch)
  render(
    wrapper(
      <DemoProvider>
        <p>Ready application</p>
      </DemoProvider>,
    ),
  )
  expect(await screen.findByText('Ready application')).toBeInTheDocument()
  expect(localDate()).toBe('2026-09-30')
  await request('/categories', { method: 'POST', body: '{}' })
  expect(fetch).toHaveBeenLastCalledWith(
    '/api/categories',
    expect.objectContaining({
      headers: expect.objectContaining({
        'X-Demo-Generation': 'session-one',
        'X-Finance-Demo': '1',
      }),
    }),
  )
})

it('does not render financial forms when runtime identification fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')))
  render(
    wrapper(
      <DemoProvider>
        <p>Ready application</p>
      </DemoProvider>,
    ),
  )
  expect(await screen.findByText(/Unable to identify/)).toBeInTheDocument()
  expect(screen.queryByText('Ready application')).not.toBeInTheDocument()
})

it('labels the review queue as simulation without asking for a real connection', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]')))
  render(
    wrapper(
      <DemoContext.Provider value={{ runtime }}>
        <GmailQueue accounts={[]} categories={[]} />
      </DemoContext.Provider>,
    ),
  )
  expect(screen.getByText(/Gmail is not connected/)).toBeInTheDocument()
  expect(screen.queryByText(/Configure the connection/)).not.toBeInTheDocument()
  expect(
    await screen.findByRole('button', { name: 'Simulation examples' }),
  ).toBeInTheDocument()
})

it('anchors demo goal calculations to the fixture date without altering normal queries', async () => {
  const fetch = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response('[]')))
  vi.stubGlobal('fetch', fetch)
  setDemoGeneration('session-one', '2026-09-30')
  await getGoals()
  expect(fetch).toHaveBeenLastCalledWith(
    '/api/goals?as_of=2026-09-30',
    expect.anything(),
  )
  setDemoGeneration()
  await getGoals()
  expect(fetch).toHaveBeenLastCalledWith('/api/goals', expect.anything())
})

it('keeps provenance at the investment footer without launch or return actions', async () => {
  navigateTo('Investments')
  render(
    wrapper(
      <DemoContext.Provider
        value={{ runtime: { ...runtime, scenario: 'unified' } }}
      >
        <DemoExperience />
        <p>Financial content</p>
        <HistoricalDemoFooter />
        <DemoScenarios settings />
      </DemoContext.Provider>,
    ),
  )
  const disclosure = screen.getByText(
    /Fictional household and holdings through/,
  )
  expect(disclosure.closest('footer')).toBeInTheDocument()
  expect(screen.getByText('Historical portfolio context')).toBeVisible()
  expect(
    screen.queryByRole('button', {
      name: /Open income demo|Return to household/,
    }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Simulate Gmail notification' }),
  ).not.toBeInTheDocument()
  await act(async () => navigateTo('Goals'))
  expect(
    screen.queryByText(/Fictional household and holdings through/),
  ).not.toBeInTheDocument()
})
