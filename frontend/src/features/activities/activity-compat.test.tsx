import { expect, it } from 'vitest'
import { activitySchema } from '@/lib/investments'
import { calculateActivityValue, toActivity } from './activity-compat'
import { groupActivitiesByDay } from './activity-day-groups'
import { flattenDayGroups } from './day-groups'

const original = activitySchema.parse({
  id: 'fictional-activity',
  request_id: 'fictional-request',
  account_id: 'fictional-account',
  asset_id: null,
  activity_type: 'FEE',
  activity_date: '2026-09-01',
  quantity: '0',
  unit_price: '0',
  gross_amount: '12.123456',
  fees: '0',
  taxes: '0',
  cash_amount: '12.123456',
  direction: 'OUT',
  currency: 'BRL',
  notes: 'Fictional fee',
  voided_at: null,
})
it('displays actual signed cash without Number conversion or a fake review state', () => {
  const row = toActivity(original, [], [])
  expect(calculateActivityValue(row)).toBe('-12.123456')
  expect(row.needsReview).toBe(false)
  expect(row.cashBalance).toBeNull()
  expect(row.original).toBe(original)
})
it('preserves server date order and exact cash in grouped/flattened rows', () => {
  const one = toActivity(original, [], [])
  const two = {
    ...one,
    id: 'second',
    date: '2026-08-31',
    cashBalance: '9007199254740993.123456',
    cashBalanceScope: 'DAY' as const,
    cashBalanceCurrency: 'BRL',
  }
  const groups = groupActivitiesByDay(
    [one, two],
    (row) => row,
    (row) => row.date,
  )
  expect(groups.map((group) => group.key)).toEqual(['2026-09-01', '2026-08-31'])
  expect(groups[1].cashBalance?.amount).toBe('9007199254740993.123456')
  expect(
    flattenDayGroups(groups, (row) => row.id).map((item) => item.kind),
  ).toEqual(['header', 'row', 'header', 'row'])
})
