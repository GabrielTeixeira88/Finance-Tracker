import { expect, it } from 'vitest'
import { financialCurve } from './chart-presentation'
import { chartCoordinates } from './money'
it('chooses steps only for genuine ledger movements', () => {
  expect(financialCurve('ledger')).toBe('stepAfter')
  expect(financialCurve('manual-observations')).toBe('monotoneX')
  expect(financialCurve('market')).toBe('monotoneX')
})
it('retains sparse exact increasing/declining and single observations without generating dates or zero fallbacks', () => {
  for (const values of [
    ['45000', '43000', '38000'],
    ['300000', '310000', '340000'],
    ['38000'],
  ]) {
    const points = values.map((balance, i) => ({
      date: `202${4 + i}-01-01`,
      balance,
    }))
    const before = JSON.stringify(points)
    const chart = chartCoordinates(points)
    expect(chart.map((p) => p.balance)).toEqual(values)
    expect(chart).toHaveLength(points.length)
    expect(JSON.stringify(points)).toBe(before)
    expect(chart.every((p) => Number.isFinite(p.coordinate))).toBe(true)
  }
})
