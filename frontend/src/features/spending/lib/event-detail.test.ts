import { it, expect } from 'vitest'
import { eventDetailProjection } from './event-detail'
import { spendingFixture } from '@/test/fixtures/synthetic/spending-workspace'
import type { EventReport } from '@/lib/life-events'
const report = (): EventReport => ({
  event: {
    id: 'e',
    name: 'Course',
    description: 'Fictional',
    event_type: 'EDUCATION',
    start_date: '2026-09-08',
    end_date: '2026-09-09',
    currency: 'BRL',
    color: 'blue',
    icon: 'book',
    planned_budget: '100',
  },
  as_of: '2026-09-30',
  actual_cost: '50',
  known_cost: '50',
  complete: true,
  missing: [],
  transaction_count: 2,
  linked_ids: ['a', 'b'],
  remaining: '50',
  categories: [{ id: 'c', name: 'Education', value: '50' }],
  daily: [
    { date: '2026-09-08', value: '20' },
    { date: '2026-09-09', value: '30' },
  ],
  native_totals: [{ currency: 'BRL', value: '50' }],
  transactions: [],
})
it('derives exact before/during/after facts from recorded calendar dates', () => {
  const history = spendingFixture()
  history.daily = history.daily.map((row, index) => ({
    ...row,
    spending:
      index < 7
        ? '10'
        : index === 7
          ? '20'
          : index === 8
            ? '30'
            : index === 9
              ? '12'
              : index === 10
                ? '13'
                : index === 11
                  ? '14'
                  : '0',
  }))
  const result = eventDetailProjection(report(), history)
  expect(result).toMatchObject({
    baseline: '10.000000',
    expected: '20.000000',
    lift: '30.000000',
    dailyDuring: '25.000000',
    beforeAvg: '10.000000',
    afterAvg: '13.000000',
    hangoverPct: '30.000000',
  })
  expect(result.peak?.amount).toBe('30')
})
it('keeps missing before/after coverage unavailable and never extrapolates future days', () => {
  const history = spendingFixture()
  history.start = '2026-09-05'
  history.end_exclusive = '2026-09-10'
  const result = eventDetailProjection(
    { ...report(), as_of: '2026-09-09' },
    history,
  )
  expect(result.baseline).toBeNull()
  expect(result.lift).toBeNull()
  expect(result.afterAvg).toBeNull()
  expect(result.afterSeries).toEqual([])
})
it('retains linked refunds outside an event window without inventing additional spending', () => {
  const value = report()
  value.actual_cost = '35'
  value.daily.push({ date: '2026-09-20', value: '-15' })
  const result = eventDetailProjection(value)
  expect(result.outOfRange).toEqual(['2026-09-20'])
  expect(result.tagged.series.at(-1)).toBe('-15')
  expect(result.dailyDuring).toBe('17.500000')
  expect(result.tagged.inWindow.at(-1)).toBe(false)
})
it('does not turn incomplete FX cost into zero or a complete category history', () => {
  const value = report()
  value.actual_cost = null
  value.complete = false
  const result = eventDetailProjection(value, spendingFixture())
  expect(result.dailyDuring).toBeNull()
  expect(result.lift).toBeNull()
  expect(result.tagged.series).toEqual([])
})
