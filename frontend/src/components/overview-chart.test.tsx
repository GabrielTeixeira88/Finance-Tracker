import { dailyClosingPoints } from '@/lib/closing-history'
import { chartCoordinates, formatMoneyParts } from '@/lib/money'

it('carries ledger values across inactive days with exact decimals, including leap day', () => {
  const points = dailyClosingPoints([
    { date: '2024-02-28', balance: '999999999999999999.123456' },
    { date: '2024-03-02', balance: '999999999999999999.123457' },
  ])
  expect(points).toEqual([
    { date: '2024-02-28', balance: '999999999999999999.123456' },
    { date: '2024-02-29', balance: '999999999999999999.123456' },
    { date: '2024-03-01', balance: '999999999999999999.123456' },
    { date: '2024-03-02', balance: '999999999999999999.123457' },
  ])
  expect(chartCoordinates(points).map((point) => point.coordinate)).toEqual([
    0, 0, 0, 100,
  ])
})

it('handles empty and constant history without manufacturing a financial trend', () => {
  expect(dailyClosingPoints([])).toEqual([])
  const points = dailyClosingPoints([{ date: '2026-09-30', balance: '0' }])
  expect(chartCoordinates(points)[0]).toMatchObject({
    balance: '0',
    coordinate: 50,
  })
})

it('splits a headline into typography parts without rounding through Number', () => {
  const parts = formatMoneyParts('-999999999999999999.123456', 'BRL', {
    locale: 'en-US',
  })
  expect(parts.map((part) => part.value).join('')).toBe(
    '-R$999,999,999,999,999,999.123456',
  )
  expect(parts.find((part) => part.type === 'fraction')?.value).toBe('123456')
})
