import { incomeSummary } from './income-summary'
import type { Income } from './investment-analytics'
it('averages one original currency across calendar buckets including empty and partial months', () => {
  const data = {
    events: [
      {
        id: 'a',
        date: '2026-01-20',
        currency: 'BRL',
        net: '10.000001',
        gross: '10.000001',
        fees: '0',
        taxes: '0',
        account_id: 'a',
        account: 'Synthetic',
        asset_id: null,
        symbol: 'Cash',
        type: 'INTEREST',
      },
      {
        id: 'b',
        date: '2026-03-01',
        currency: 'USD',
        net: '900',
        gross: '900',
        fees: '0',
        taxes: '0',
        account_id: 'b',
        account: 'Synthetic',
        asset_id: null,
        symbol: 'Cash',
        type: 'INTEREST',
      },
    ],
    months: [],
    breakdowns: {},
  } as Income
  const summary = incomeSummary(data, 'BRL', '2026-01-15', '2026-03-10')
  expect(summary.rows.map((r) => r.net)).toEqual([
    '10.000001',
    '0.000000',
    '0.000000',
  ])
  expect(summary.average).toBe('3.333334')
  expect(summary.months).toBe(3)
})
