import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GoalProgress } from './goal-progress'
import { DemoContext } from '@/lib/demo-runtime'
import { goalTitle, goalPercent, goalTimeLeft } from '@/lib/goal-display'
import { formatMoney } from '@/lib/money'
import { goalDetailSchema } from '@/lib/wealth-api'

const detail = goalDetailSchema.parse({
  goal: {
    id: 'g',
    name: 'Synthetic / Home studio',
    mode: 'MANUAL',
    currency: 'BRL',
    target: '15000',
    start_date: '2026-01-01',
    deadline: '2027-12-31',
    status: 'PAUSED',
    notes: '',
  },
  saved: '1999.999998',
  remaining: '13000.000002',
  allocated: '0',
  progress: '0.133333',
  warnings: [],
  entries: [],
  milestones: [],
  required_monthly: null,
  projected_completion: null,
  overdue: false,
  near_deadline: false,
  history: [],
  projection_method: 'Contribution only',
})

describe('goal presentation', () => {
  it('uses backend schedule pace for red progress before the deadline', () => {
    const { rerender } = render(
      <GoalProgress
        data={{
          ...detail,
          goal: { ...detail.goal, status: 'ACTIVE' },
          as_of: '2026-09-30',
          schedule_pace: {
            status: 'OFF_TRACK',
            required_to_date: '6000',
            basis: 'Required to date',
          },
        }}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByText('Off track')).toBeVisible()
    expect(document.querySelector('.goal-card-completion')).toHaveClass(
      'negative',
    )
    expect(document.querySelector('.goal-card-fill')).toHaveClass('is-overdue')
    expect(screen.getByText(/1y 3m left/)).toBeVisible()
    rerender(
      <GoalProgress
        data={{
          ...detail,
          schedule_pace: {
            status: 'PAUSED',
            required_to_date: null,
            basis: 'Required to date',
          },
        }}
        onOpen={() => {}}
      />,
    )
    expect(document.querySelector('.goal-card-completion')).not.toHaveClass(
      'negative',
      'is-positive',
    )
  })

  it('counts calendar months, short deadlines and overdue days without timezone shifts', () => {
    expect(goalTimeLeft('2026-11-01', '2026-10-31')).toBe('1 day left')
    expect(goalTimeLeft('2026-11-02', '2026-10-31')).toBe('2 days left')
    expect(goalTimeLeft('2027-01-31', '2026-10-31')).toBe('3 months left')
    expect(goalTimeLeft('2028-02-29', '2028-02-28')).toBe('1 day left')
    expect(goalTimeLeft('2026-10-31', '2026-10-31')).toBe('Due today')
    expect(goalTimeLeft('2026-10-30', '2026-10-31')).toBe('1 day overdue')
    expect(goalTimeLeft('2027-10-31', '2026-10-31')).toBe('1 year left')
    expect(goalTimeLeft(null, '2026-10-31')).toBe('No deadline')
    expect(goalTimeLeft('2026-02-30', '2026-10-31')).toBe('Unavailable')
  })
  it('rounds visible money and percentage without changing the source values', () => {
    render(<GoalProgress data={detail} onOpen={() => {}} />)
    expect(screen.getByText('13,33%')).toBeVisible()
    const saved = screen.getByText('R$ 2.000,00')
    expect(saved).toHaveAttribute('title', 'R$ 2.000,00 (BRL)')
    expect(screen.getByText('R$ 13.000,00')).toBeVisible()
    expect(detail.saved).toBe('1999.999998')
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('.goal-ring')).toBeNull()
  })

  it('cleans only known demo goal titles, preserving personal and custom names', () => {
    render(
      <DemoContext.Provider
        value={{
          runtime: {
            mode: 'local_demo',
            profile: 'Fictional',
            generation: 'fake',
            start_date: '2024-10-01',
            end_date: '2026-09-30',
          },
        }}
      >
        <GoalProgress data={detail} onOpen={() => {}} />
      </DemoContext.Provider>,
    )
    expect(screen.getByRole('button', { name: 'Home studio' })).toBeVisible()
    expect(goalTitle('Synthetic / Home studio', false)).toBe(
      'Synthetic / Home studio',
    )
    expect(goalTitle('Synthetic / Custom goal', true)).toBe(
      'Synthetic / Custom goal',
    )
  })

  it('keeps overfunding visible and missing coverage unavailable', () => {
    const { rerender } = render(
      <GoalProgress data={{ ...detail, progress: '1.2' }} onOpen={() => {}} />,
    )
    expect(screen.getByText('120,00%')).toBeVisible()
    expect(document.querySelector('.goal-card-fill')).toHaveStyle({
      width: '100%',
    })
    rerender(
      <GoalProgress
        data={{ ...detail, progress: null, saved: null, remaining: null }}
        onOpen={() => {}}
      />,
    )
    expect(screen.queryByText('0,00%')).toBeNull()
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
  })

  it('uses fixed localized decimal precision, including large exact values', () => {
    expect(goalPercent('1')).toBe('100,00%')
    expect(goalPercent('0.025')).toBe('2,50%')
    expect(
      formatMoney('9007199254740993.999998', 'BRL', {
        locale: 'en-US',
        fractionDigits: 2,
      }),
    ).toBe('R$ 9.007.199.254.740.994,00')
    expect(
      formatMoney('1999.999998', 'BRL', { locale: 'pt-BR', fractionDigits: 2 }),
    ).toBe('R$ 2.000,00')
    expect(
      formatMoney('-1.234567', 'USD', { locale: 'en-US', fractionDigits: 2 }),
    ).toBe('-US$ 1,23')
    expect(
      formatMoney('20', 'JPY', { locale: 'en-US', fractionDigits: 2 }),
    ).toBe('JP¥ 20,00')
  })
})
