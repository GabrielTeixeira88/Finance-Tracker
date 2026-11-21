import {
  incomePeriod,
  previousYear,
  incomeChange,
  receivedIncome,
  incomeAxis,
} from './income-dashboard'
import { incomeSchema } from './investment-analytics'

it('aligns source-style nice ticks without rounding monetary maxima through Number', () => {
  const left = incomeAxis(2354_000000n)
  expect(left.values).toEqual([0n, 1000_000000n, 2000_000000n, 3000_000000n])
  const right = incomeAxis(9865_000000n, left.values.length)
  expect(right.values).toEqual([0n, 5000_000000n, 10000_000000n, 15000_000000n])
  expect(right.ticks).toEqual(left.ticks)
  const huge = incomeAxis(999999999999999999999999999999n)
  expect(huge.top).toBeGreaterThan(999999999999999999999999999999n)
  expect(huge.ticks.at(-1)).toBe(100)
})

it('uses inclusive income periods without leaking December 31 into YTD', () => {
  expect(incomePeriod('YTD', '2026-09-30')).toEqual({
    start: '2026-01-01',
    end: '2026-09-30',
    previousStart: '2025-01-01',
    previousEnd: '2025-09-30',
  })
  expect(incomePeriod('LAST_YEAR', '2026-09-30').end).toBe('2025-12-31')
  expect(incomePeriod('LAST_YEAR', '2026-09-30').start).toBe('2025-01-01')
  expect(previousYear('2024-02-29')).toBe('2023-02-28')
  expect(incomePeriod('Custom', '2026-09-30', '2026-04-15').start).toBe(
    '2026-04-15',
  )
})

it('compares exact monetary values and leaves zero/unknown comparison bases unavailable', () => {
  expect(incomeChange('9007199254740993', '18014398509481986')).toBe(
    '-50.000000',
  )
  expect(incomeChange('120', '100')).toBe('20.000000')
  expect(incomeChange('120', '0')).toBeNull()
  expect(incomeChange('120', null)).toBeNull()
})

it('derives account and prior-month chart data in one original currency and keeps empty months', () => {
  const event = {
    id: 'fake',
    date: '2026-01-15',
    currency: 'BRL',
    gross: '100',
    net: '95',
    fees: '0',
    taxes: '5',
    account_id: 'a',
    account: 'Fictional A',
    asset_id: null,
    symbol: 'Cash',
    type: 'INTEREST',
  }
  const data = incomeSchema.parse({
    events: [
      event,
      {
        ...event,
        id: 'fake-b',
        account_id: 'b',
        account: 'Fictional B',
        date: '2026-03-01',
        net: '10',
        gross: '10',
        taxes: '0',
      },
      { ...event, id: 'old', date: '2025-12-31', net: '999' },
      { ...event, id: 'foreign', currency: 'USD', net: '500' },
    ],
    months: [],
    breakdowns: {},
  })
  const previous = incomeSchema.parse({
    events: [{ ...event, date: '2025-01-15', net: '50' }],
    months: [],
    breakdowns: {},
  })
  const result = receivedIncome(
    data,
    'BRL',
    '2026-01-01',
    '2026-03-31',
    previous,
  )
  expect(result.total).toBe('105.000000')
  expect(result.average).toBe('35.000000')
  expect(result.rows.map((row) => row.net)).toEqual([
    '95.000000',
    '0.000000',
    '10.000000',
  ])
  expect(result.rows[0].previous).toBe('50.000000')
  expect(result.rows[0].accounts).toEqual({ a: '95.000000', b: '0.000000' })
  expect(result.types.find((type) => type.name === 'INTEREST')?.value).toBe(
    '105.000000',
  )
  expect(result.events).toHaveLength(2)
})
