import { expect, it } from 'vitest'
import {
  defaultSidebarOrder,
  moveSidebarItem,
  normalizeSidebarOrder,
} from './sidebar-order'
it('validates stored IDs, removes duplicates and appends missing navigation', () => {
  expect(normalizeSidebarOrder(['Goals', 'Goals', 'invalid', 4])).toEqual([
    'Goals',
    ...defaultSidebarOrder.filter((id) => id !== 'Goals'),
  ])
  expect(normalizeSidebarOrder(null)).toEqual(defaultSidebarOrder)
  expect(normalizeSidebarOrder({})).toEqual(defaultSidebarOrder)
})
it('moves neighboring icons without mutating the input or dropping destinations', () => {
  const moved = moveSidebarItem(defaultSidebarOrder, 'Goals', -1)
  expect(moved.slice(4)).toEqual(['Goals', 'Insights', 'Settings'])
  expect(defaultSidebarOrder[4]).toBe('Insights')
  expect(moveSidebarItem(defaultSidebarOrder, 'Dashboard', -1)).toEqual(
    defaultSidebarOrder,
  )
  expect(moveSidebarItem(defaultSidebarOrder, 'Settings', 1)).toEqual(
    defaultSidebarOrder,
  )
})
