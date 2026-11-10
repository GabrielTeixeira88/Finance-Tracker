import { expect, it } from 'vitest'
import { netWorthStart } from './net-worth-period'
it.each([
  ['1D', '2026-09-30', '2026-09-29'],
  ['1W', '2026-09-30', '2026-09-23'],
  ['1M', '2025-03-31', '2025-02-28'],
  ['1M', '2024-03-31', '2024-02-29'],
  ['3M', '2026-09-30', '2026-06-30'],
  ['YTD', '2026-09-30', '2026-01-01'],
  ['1Y', '2024-02-29', '2023-02-28'],
  ['5Y', '2026-09-30', '2021-09-30'],
  ['ALL', '2026-09-30', '2016-09-30'],
  ['ALL', '0005-01-01', '0002-01-01'],
])(
  'uses the source rolling %s range without DST/month rollover (%s)',
  (period, end, start) => expect(netWorthStart(period, end, '')).toBe(start),
)
it('retains explicit custom dates and sends malformed URL dates to API validation', () => {
  expect(netWorthStart('Custom', '2026-09-30', '2025-06-20')).toBe('2025-06-20')
  expect(netWorthStart('1M', 'invalid', '')).toBe('invalid')
})
