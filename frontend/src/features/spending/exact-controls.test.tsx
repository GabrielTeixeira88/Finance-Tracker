import '../holdings/i18n'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AmountInput } from './components/amount-input'
import { CashFlowStrip } from './components/cash-flow-strip'
import { setPreferences } from '@/lib/preferences'
import { EventsTimelineCard } from './components/reports/insights/events-timeline-card'
import { spendingFixture } from '@/test/fixtures/synthetic/spending-workspace'
import './i18n'
beforeEach(() => setPreferences({ language: 'en' }))
afterEach(() => setPreferences({ language: 'en' }))

it('keeps an unavailable event comparison neutral and explained without disabling keyboard selection', () => {
  const choose = vi.fn()
  render(
    <EventsTimelineCard
      events={[
        {
          eventId: 'course',
          eventName: 'Course',
          eventTypeId: 'EDUCATION',
          eventTypeName: 'Education',
          eventTypeColor: null,
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          totalSpending: '250',
          transactionCount: 1,
          currency: 'BRL',
        },
      ]}
      currency="BRL"
      rangeStart={new Date('2026-09-01T12:00:00')}
      rangeEnd={new Date('2026-09-30T12:00:00')}
      report={spendingFixture()}
      selectedId={null}
      onSelect={choose}
      windowOffset={0}
      onPrevWindow={vi.fn()}
      onNextWindow={vi.fn()}
    />,
  )
  const event = screen.getByRole('button', { name: 'Course' })
  expect(event).toHaveAccessibleDescription(/recorded baseline is unavailable/)
  expect(within(event).getByText('—')).toHaveClass('fill-muted-foreground')
  fireEvent.keyDown(event, { key: 'Enter' })
  expect(choose).toHaveBeenCalledWith('course')
})

it('commits every decimal digit, defers external updates during typing and rejects malformed money', () => {
  const commit = vi.fn()
  const view = render(<AmountInput value="100" onCommit={commit} />)
  const input = screen.getByRole('textbox')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '9007199254740993.123456' } })
  view.rerender(<AmountInput value="200" onCommit={commit} />)
  expect(input).toHaveValue('9007199254740993.123456')
  fireEvent.blur(input)
  expect(commit).toHaveBeenLastCalledWith('9007199254740993.123456')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '12.34.5' } })
  fireEvent.blur(input)
  expect(commit).toHaveBeenCalledOnce()
  expect(input).toHaveAttribute('aria-invalid', 'true')
})

it('keeps localized Brazilian target input exact', () => {
  setPreferences({ language: 'pt-BR' })
  const commit = vi.fn()
  render(<AmountInput value="100.123456" onCommit={commit} />)
  const input = screen.getByRole('textbox')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '1.234,654321' } })
  fireEvent.blur(input)
  expect(commit).toHaveBeenCalledWith('1234.654321')
})

it('renders source cash-flow geometry with exact net saving separate from consumer spending', () => {
  render(
    <CashFlowStrip
      income="1000"
      spending="200"
      saving="500"
      fromSavings="100"
      currency="BRL"
    />,
  )
  expect(screen.getByText('Net saved')).toBeInTheDocument()
  expect(screen.getAllByText('R$ 400,00')).toHaveLength(1)
  expect(screen.getByText('+R$ 400,00')).toBeInTheDocument()
  expect(screen.getByText('+R$ 1.000,00')).toBeInTheDocument()
})

it('formats percentage units once rather than multiplying the change by 100 again', () => {
  render(
    <SpendingDeltaLine
      delta="250.123456"
      deltaPct="62.530864"
      currency="BRL"
    />,
  )
  expect(screen.getByText('62,53%')).toBeInTheDocument()
})
import { SpendingDeltaLine } from './components/spending-delta-line'
