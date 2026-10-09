import { chartCoordinates, sumMoney } from './money'

it('normalizes huge, very close exact balances without losing their display values', () => {
  const rows = chartCoordinates([
    { date: '2026-01-01', balance: '999999999999999999.123450' },
    { date: '2026-01-02', balance: '999999999999999999.123453' },
    { date: '2026-01-03', balance: '999999999999999999.123456' },
  ])
  expect(rows.map((row) => row.coordinate)).toEqual([0, 50, 100])
  expect(rows[2].balance).toBe('999999999999999999.123456')
  expect(sumMoney(['0.1', '0.2'])).toBe('0.300000')
})

it('supports negative and flat chart balances', () => {
  expect(
    chartCoordinates([{ date: '2026-01-01', balance: '-42' }])[0].coordinate,
  ).toBe(50)
  expect(chartCoordinates([])).toEqual([])
})
