import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReceivedIncomeDashboard } from './income-dashboard'
import { incomeSchema } from '@/lib/investment-analytics'

// Clearly fictional API response; no demo ledger or real data is modified.
const empty = incomeSchema.parse({ events: [], months: [], breakdowns: {} })

it('keeps an informative received view without fabricating a zero history chart', async () => {
  const accrued = vi.fn()
  render(
    <ReceivedIncomeDashboard
      data={empty}
      currency="BRL"
      start="2026-01-01"
      end="2026-09-30"
      period="YTD"
      onAccrued={accrued}
      onSecurity={vi.fn()}
    />,
  )
  expect(screen.getByText('No investment payments recorded')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Monthly average' })).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Income history' }),
  ).not.toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', { name: 'Explore accrued earnings' }),
  )
  expect(accrued).toHaveBeenCalledOnce()
})

it('uses exact recorded net payments and retains holding navigation', async () => {
  const open = vi.fn()
  const data = incomeSchema.parse({
    events: [
      {
        id: 'fake',
        date: '2026-09-15',
        account_id: 'fake-account',
        account: 'Fictional brokerage',
        asset_id: 'fake-asset',
        symbol: 'FAKE-DIV',
        type: 'DIVIDEND',
        currency: 'BRL',
        gross: '100',
        fees: '2',
        taxes: '3',
        net: '95',
      },
    ],
    months: [
      {
        month: '2026-09',
        currency: 'BRL',
        gross: '100',
        fees: '2',
        taxes: '3',
        net: '95',
      },
    ],
    breakdowns: {
      security: [
        {
          id: 'fake-asset',
          name: 'FAKE-DIV',
          currency: 'BRL',
          gross: '100',
          fees: '2',
          taxes: '3',
          net: '95',
        },
      ],
    },
  })
  render(
    <ReceivedIncomeDashboard
      data={data}
      currency="BRL"
      start="2026-09-01"
      end="2026-09-30"
      period="1M"
      onAccrued={vi.fn()}
      onSecurity={open}
    />,
  )
  expect(screen.getAllByText('R$ 95,00').length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: 'FAKE-DIV' }))
  expect(open).toHaveBeenCalledWith('fake-asset')
})
