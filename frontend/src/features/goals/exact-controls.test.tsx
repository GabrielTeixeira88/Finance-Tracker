import { render, fireEvent, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { GoalLeverRow } from './components/goal-lever-row'
import { sliderAmount, sliderMaxFor, sliderPosition } from './lib/exact-slider'
import { SavingsMilestonesCard } from './save-up/components/savings-milestones-card'
import { setPreferences } from '@/lib/preferences'

it('keeps large and localized planner drafts exact across external previews and cancels Escape', () => {
  setPreferences({ language: 'pt-BR' })
  const commit = vi.fn()
  const view = render(
    <GoalLeverRow
      label="Monthly contribution"
      value="100.123456"
      max="1000"
      onChange={commit}
    />,
  )
  const field = screen.getByRole('textbox', { name: 'Monthly contribution' })
  fireEvent.focus(field)
  fireEvent.change(field, { target: { value: '9.007.199.254.740.993,123456' } })
  view.rerender(
    <GoalLeverRow
      label="Monthly contribution"
      value="200"
      max="1000"
      onChange={commit}
    />,
  )
  expect(field).toHaveValue('9.007.199.254.740.993,123456')
  fireEvent.blur(field)
  expect(commit).toHaveBeenCalledWith('9007199254740993.123456')
  fireEvent.focus(field)
  fireEvent.change(field, { target: { value: '-10' } })
  fireEvent.blur(field)
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(commit).toHaveBeenCalledTimes(1)
  fireEvent.focus(field)
  fireEvent.change(field, { target: { value: '30' } })
  field.focus()
  fireEvent.keyDown(field, { key: 'Escape' })
  expect(commit).toHaveBeenCalledTimes(1)
  setPreferences({ language: 'en' })
})

it('maps only dimensionless slider coordinates to Number and never rounds typed values', () => {
  expect(
    sliderPosition('9007199254740993.123456', '0', '18014398509481986.246912'),
  ).toBe(5000)
  expect(
    sliderAmount('5000', '0', '18014398509481986.246912', '0.000001'),
  ).toBe('9007199254740993.123456')
  expect(sliderAmount('10000', '0', '100', '1')).toBe('100.000000')
  expect(sliderMaxFor('100.123456', '100', '10')).toBe('120.000000')
  expect(() => sliderAmount('10001', '0', '100', '1')).toThrow()
})

it('retains source desktop/mobile milestone rails, exact values and unknown timing', () => {
  render(
    <SavingsMilestonesCard
      currency="BRL"
      currentValue={null}
      isHidden={false}
      milestones={[
        {
          ratio: 0.25,
          label: '25%',
          amount: '9007199254740993.123456',
          dateLabel: 'Date unavailable',
          reached: false,
          isFinal: false,
        },
        {
          ratio: 1,
          label: '100%',
          amount: '36028797018963972.493824',
          dateLabel: 'Estimated December 2027',
          reached: false,
          isFinal: true,
        },
      ]}
    />,
  )
  expect(screen.getAllByText('R$ 9.007.199.254.740.993,12')).toHaveLength(2)
  expect(screen.getAllByText('Date unavailable')).toHaveLength(2)
  expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument()
})
