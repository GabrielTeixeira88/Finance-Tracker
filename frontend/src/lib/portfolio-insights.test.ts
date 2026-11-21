import { allocationSchema } from './investment-analytics'
import {
  classChildren,
  groupRows,
  portfolioWeight,
  summaryValues,
} from './portfolio-insights'

const data = allocationSchema.parse({
  currency: 'BRL',
  quality: 'COMPLETE',
  reasons: [],
  total_value: '1000',
  known_value: '1000',
  metadata_policy: '',
  concentration: {},
  groups: {},
  rows: [
    {
      account_id: 'a',
      asset_id: 'rdb',
      security: 'Reserve',
      account: 'Brokerage',
      currency: 'BRL',
      original_value: '400',
      value: '400',
      asset_class: 'BOND',
      instrument_type: 'RDB_CDI',
    },
    {
      account_id: 'b',
      asset_id: 'rdb',
      security: 'Reserve',
      account: 'Other',
      currency: 'BRL',
      original_value: '200',
      value: '200',
      asset_class: 'BOND',
      instrument_type: 'RDB_CDI',
    },
    {
      account_id: 'a',
      asset_id: 'cdb',
      security: 'CDB',
      account: 'Brokerage',
      currency: 'BRL',
      original_value: '300',
      value: '300',
      asset_class: 'BOND',
      instrument_type: 'CDB_FIXED',
    },
    {
      account_id: 'a',
      asset_id: null,
      security: 'Cash',
      account: 'Brokerage',
      currency: 'BRL',
      original_value: '100',
      value: '100',
      asset_class: 'CASH',
      instrument_type: 'CASH',
    },
  ],
})
const parent = {
  name: 'BOND',
  value: '700',
  weight_percent: '70',
  members: [
    { account_id: 'a', asset_id: 'rdb' },
    { account_id: 'a', asset_id: 'cdb' },
  ],
}

it('drills fixed-income class using contract types and exact account/asset membership', () => {
  expect(groupRows(data, parent)).toHaveLength(2)
  const children = classChildren(data, parent)
  expect(children.map((r) => [r.name, r.value, r.weight_percent])).toEqual([
    ['RDB_CDI', '400.000000', '40.000000'],
    ['CDB_FIXED', '300.000000', '30.000000'],
  ])
  expect(summaryValues(data).cash_value).toBe('100.000000')
  expect(summaryValues(data).invested_value).toBe('900.000000')
  expect(summaryValues(data).holdings_count).toBe(2)
})
it('does not normalize partial known values or fabricate basis/exposure', () => {
  const partial = { ...data, quality: 'PARTIAL', total_value: null }
  expect(portfolioWeight('400', partial)).toBeNull()
  expect(
    classChildren(partial, parent).every((g) => g.weight_percent === null),
  ).toBe(true)
  expect(summaryValues(partial).cost_basis).toBeNull()
  expect(classChildren(data, { ...parent, members: [] })).toEqual([])
  expect(portfolioWeight('-1', data)).toBeNull()
})
it('retains exact ratios above safe integer monetary sizes', () => {
  expect(
    portfolioWeight('9007199254740993', {
      ...data,
      total_value: '18014398509481986',
    }),
  ).toBe('50.000000')
})
