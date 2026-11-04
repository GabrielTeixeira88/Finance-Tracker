import {
  budgetMonthForPeriod,
  previousSpendingPeriod,
  spendingPeriod,
  validDay,
} from './spending-period'

it('clamps month-to-date comparisons at leap and short month boundaries', () => {
  expect(previousSpendingPeriod('2024-03-01', '2024-03-31', true)).toEqual({
    start: '2024-02-01',
    end: '2024-02-29',
  })
  expect(previousSpendingPeriod('2026-03-01', '2026-03-15', true)).toEqual({
    start: '2026-02-01',
    end: '2026-02-15',
  })
  expect(spendingPeriod('LAST', '2026-01-15')).toEqual({
    start: '2025-12-01',
    end: '2025-12-31',
  })
})
it('uses preceding equal-length custom periods and real calendar ranges', () => {
  expect(previousSpendingPeriod('2026-10-05', '2026-10-10', false)).toEqual({
    start: '2026-09-29',
    end: '2026-10-04',
  })
  expect(spendingPeriod('3M', '2026-01-31')).toEqual({
    start: '2025-11-01',
    end: '2026-01-31',
  })
  expect(validDay('2026-02-30')).toBe(false)
})
it('synchronizes exact months but keeps broader spending scopes separate from budgets', () => {
  expect(budgetMonthForPeriod('2026-08-01', '2026-08-31', '2026-10-10')).toBe(
    '2026-08',
  )
  expect(budgetMonthForPeriod('2026-07-01', '2026-09-30', '2026-10-10')).toBe(
    '2026-10',
  )
})
