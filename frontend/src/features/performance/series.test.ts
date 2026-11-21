import { prepareSeries, axisPercent, exactPercent } from './series'
import { bpsPercent, bpsPoints, inputBps } from './target-math'
import { getTopMovers } from './holdings-highlights'
import type { Holding } from '@/features/holdings/types'
it('normalizes a shared percentage axis without losing exact labels or filling gaps', () => {
  const result = prepareSeries([
    {
      id: 'one',
      name: 'One',
      returns: [
        { date: '2026-01-01', value: '-20' },
        { date: '2026-01-02', value: null },
        { date: '2026-01-03', value: '20' },
      ],
    },
    {
      id: 'two',
      name: 'Two',
      returns: [
        { date: '2026-01-01', value: '0' },
        { date: '2026-01-03', value: '10' },
      ],
    },
  ])
  expect(result.rows[0]['series-0']).toBe(0)
  expect(result.rows[0]['series-1']).toBe(0.5)
  expect(result.rows[1]['series-0']).toBeNull()
  expect(result.rows[1]['series-1']).toBeNull()
  expect(result.rows[2].exact['series-1']).toBe('10')
  expect(axisPercent(0.5, result.minimum, result.maximum)).toBe('0,00%')
})
it('retains large exact percentages and handles constant/empty series', () => {
  const result = prepareSeries([
    {
      id: 'huge',
      name: 'Huge',
      returns: [{ date: '2026-01-01', value: '9007199254740993.123456' }],
    },
  ])
  expect(result.rows[0]['series-0']).toBe(0.5)
  expect(result.rows[0].exact['series-0']).toBe('9007199254740993.123456')
  expect(exactPercent(result.rows[0].exact['series-0'])).toBe(
    '9.007.199.254.740.993,12%',
  )
  expect(prepareSeries([]).rows).toEqual([])
})
it('parses exact target percentages to bounded BPS and formats exact drift', () => {
  expect(inputBps('33.33')).toBe(3333)
  expect(inputBps('100')).toBe(10000)
  expect(inputBps('5.000000')).toBe(500)
  expect(bpsPoints('100')).toBe('1,00 pp')
  expect(() => inputBps('100.01')).toThrow()
  expect(() => inputBps('33.333')).toThrow()
  expect(() => inputBps('-1')).toThrow()
  expect(bpsPercent('-127.456789')).toBe('-1,27%')
  expect(bpsPercent(null)).toBe('—')
})
it('ranks only open, observed securities with exact values', () => {
  const base = {
    holdingType: 'SECURITY',
    isClosed: false,
    quantity: '10',
    instrument: { id: 'a' },
    dayChange: { local: '1', base: null },
    dayChangePct: '0.02',
  }
  // Test partial data does not exercise unrelated holding fields.
  const row = (
    id: string,
    change: string | null,
    extra: object = {},
  ): Holding =>
    ({
      ...base,
      id,
      instrument: { id },
      dayChange: { local: change, base: null },
      ...extra,
    }) as Holding
  const rows = [
    row('gain', '9007199254740993.000001'),
    row('gain2', '9007199254740993'),
    row('loss', '-2'),
    row('missing', null),
    row('closed', '50', { isClosed: true }),
    row('cash', '100', { holdingType: 'CASH' }),
    row('zero', '0'),
  ]
  expect(getTopMovers(rows, 'amount').gainers.map((h) => h.id)).toEqual([
    'gain',
    'gain2',
  ])
  expect(getTopMovers(rows, 'amount').losers.map((h) => h.id)).toEqual(['loss'])
})
