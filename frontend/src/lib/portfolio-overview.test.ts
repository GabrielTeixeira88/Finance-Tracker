import { overviewGroups, topHoldings } from './portfolio-overview'
import type { Allocation } from './investment-analytics'

const row = (
  account: string,
  asset: string | null,
  value: string | null,
): NonNullable<Allocation['rows']>[number] => ({
  account_id: account,
  asset_id: asset,
  account: 'Same account label',
  security: asset ?? 'Cash',
  currency: 'USD',
  original_value: '1',
  value,
})
it('aggregates converted values exactly, keeps account identities separate, and counts cash once', () => {
  const rows = [
    row('a', 'fund', '9007199254740993.123456'),
    row('a', null, '0.000001'),
    row('b', 'fund', '2.000001'),
  ]
  expect(overviewGroups(rows, 'account_id').map((r) => r.value)).toEqual([
    '9007199254740993.123457',
    '2.000001',
  ])
  expect(topHoldings(rows)).toEqual([
    { id: 'fund', name: 'fund', value: '9007199254740995.123457' },
  ])
})
it('excludes incomplete holdings rather than ranking their partial subtotal; returns five known holdings', () => {
  const rows = [
    row('a', 'unknown', null),
    row('b', 'unknown', '999999'),
    ...Array.from({ length: 7 }, (_, i) =>
      row('a', `fund-${i}`, `${i}.000001`),
    ),
  ]
  expect(topHoldings(rows).map((r) => r.id)).toEqual([
    'fund-6',
    'fund-5',
    'fund-4',
    'fund-3',
    'fund-2',
  ])
  expect(overviewGroups(rows, 'account_id')[0].value).toBeNull()
})
