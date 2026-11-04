import { budgetFixture } from '@/test/fixtures/synthetic/budget'
import { budgetCurve } from './budget-curve'

it('retains exact cumulative amounts, refunds and amounts beyond safe JS integers', () => {
  const data = budgetFixture()
  data.daily = [
    { date: '2026-09-01', amount: '9007199254740993.123456' },
    { date: '2026-09-02', amount: '-0.123456' },
    { date: '2026-09-03', amount: '0.000001' },
  ]
  const curve = budgetCurve(data)
  expect(curve.points.map((row) => row.amount)).toEqual([
    '9007199254740993.123456',
    '9007199254740993.000000',
    '9007199254740993.000001',
  ])
  expect(curve.path).not.toMatch(/NaN|Infinity/)
  expect(curve.forecast).toBeNull()
})
it('uses the API projection only for the unelapsed portion of a current month', () => {
  const data = budgetFixture()
  data.as_of = '2026-09-10'
  data.pace = { ...data.pace, status: 'current', projection: '1000' }
  data.daily = [
    { date: '2026-09-10', amount: '100' },
    { date: '2026-09-11', amount: '999' },
  ]
  const curve = budgetCurve(data)
  expect(curve.points).toHaveLength(1)
  expect(curve.forecast).toMatch(/^M .* L 320 /)
  data.pace.projection = null
  expect(budgetCurve(data).forecast).toBeNull()
})
