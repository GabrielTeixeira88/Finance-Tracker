import { expect, it } from 'vitest'
import { syntheticReport } from '@/test/fixtures/synthetic/net-worth'
import {
  netWorthGroups,
  percentOf,
  netWorthChartGeometry,
} from './net-worth-view'

it('groups cash without duplicating investment accounts or debt and inverts debt change', () => {
  const groups = netWorthGroups(syntheticReport())
  expect(groups).toHaveLength(2)
  expect(groups.find((g) => g.label === 'cash')?.value).toBe('10000.000000')
  expect(groups.find((g) => g.kind === 'LIABILITY')?.change).toBe('500.000000')
})
it('retains missing category data instead of inventing history or allocation', () => {
  const report = syntheticReport()
  report.categories[0].value = null
  report.points[0].breakdown!['ASSET:CHECKING'] = null
  const cash = netWorthGroups(report).find((g) => g.label === 'cash')!
  expect(cash.value).toBeNull()
  expect(cash.history[0].value).toBeNull()
  expect(cash.change).toBeNull()
})
it('does not turn a prior positive bank balance into historical debt', () => {
  const report = syntheticReport()
  report.components[0].native_value = '-200'
  report.components[0].value = '-200'
  report.points[0].component_values = { 'fake-account': '1000' }
  report.points[1].component_values = { 'fake-account': '-200' }
  const debt = netWorthGroups(report).find(
    (g) => g.key === 'LIABILITY:fake-account',
  )!
  expect(debt.history.map((p) => p.value)).toEqual(['0.000000', '200.000000'])
  expect(debt.change).toBe('-200.000000')
  report.points[0].component_values['fake-account'] = null
  expect(
    netWorthGroups(report).find((g) => g.key === debt.key)?.change,
  ).toBeNull()
})
it('computes shares from exact large decimals and rejects a nonpositive baseline', () => {
  expect(
    percentOf('999999999999999999.999999', '1999999999999999999.999998'),
  ).toBe('0.500000')
  expect(percentOf('1', '0')).toBeNull()
  expect(percentOf('1', '-1')).toBeNull()
})

it('keeps chart coordinates dimensionless, bounded and missing across signs and large values', () => {
  const original = [
    { date: '2025-01-01', value: '-999999999999999999.999999' },
    { date: '2025-01-02', value: null },
    { date: '2025-01-03', value: '999999999999999999.999999' },
  ]
  const geometry = netWorthChartGeometry(original)
  expect(geometry.crossesZero).toBe(true)
  expect(geometry.data[1].coordinate).toBeNull()
  expect(
    geometry.data.every(
      (p) => p.coordinate === null || Math.abs(p.coordinate) <= 10,
    ),
  ).toBe(true)
  expect(geometry.data[0].value).toBe(original[0].value)
  const flat = netWorthChartGeometry([{ date: '2025-01-01', value: '0' }])
  expect(flat.flat).toBe(true)
  expect(flat.padding).toBeGreaterThan(0)
})
