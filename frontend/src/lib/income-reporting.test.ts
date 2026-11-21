import {
  incomeSchema,
  incomeReportingSchema,
  reportedIncome,
} from './investment-analytics'
import { receivedIncome } from './income-dashboard'

const event = {
  id: 'fake',
  date: '2026-09-30',
  account_id: 'a',
  account: 'Fictional brokerage',
  asset_id: null,
  symbol: 'Cash interest',
  type: 'INTEREST',
  currency: 'BRL',
  gross: '500',
  fees: '0',
  taxes: '0',
  net: '500',
}
const report = incomeReportingSchema.parse({
  currency: 'BRL',
  quality: 'COMPLETE',
  missing_currencies: [],
  totals: { gross: '500', fees: '0', taxes: '0', net: '500' },
  known_net: '500',
  start: '2026-09-01',
  end: '2026-09-30',
  method: 'PAYMENT_DATE_FX',
  fx_policy: 'CACHED',
  events: [
    {
      ...event,
      original: {
        currency: 'USD',
        gross: '100',
        fees: '0',
        taxes: '0',
        net: '100',
      },
      fx: { date: '2026-09-30', rate: '5', provider: 'ECB' },
    },
  ],
  months: [
    {
      month: '2026-09',
      currency: 'BRL',
      gross: '500',
      fees: '0',
      taxes: '0',
      net: '500',
    },
  ],
  breakdowns: {},
})
it('adapts complete reporting data without mutating original payments', () => {
  const original = { ...event, currency: 'USD', gross: '100', net: '100' }
  const data = incomeSchema.parse({
    events: [original],
    months: [],
    breakdowns: {},
    reporting: report,
  })
  const converted = reportedIncome(data)!
  expect(
    receivedIncome(converted, 'BRL', '2026-09-01', '2026-09-30').total,
  ).toBe('500.000000')
  expect(data.events[0]).toEqual(original)
  expect(data.reporting?.events[0].fx?.date).toBe('2026-09-30')
})
it('never passes missing-rate projections to zero-filling chart adapters', () => {
  const data = incomeSchema.parse({
    events: [],
    months: [],
    breakdowns: {},
    reporting: {
      ...report,
      quality: 'PARTIAL',
      missing_currencies: ['USD'],
      totals: { gross: null, fees: null, taxes: null, net: null },
    },
  })
  expect(reportedIncome(data)).toBeUndefined()
})
