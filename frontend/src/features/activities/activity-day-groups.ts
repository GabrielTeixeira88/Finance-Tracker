// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/pages/activity/components/activity-table/activity-day-groups.ts; exact local adapters.
import type { DayGroup } from './day-groups'
import type { ActivityDetails } from './activity-compat'

export interface ActivityDayGroup<T> extends DayGroup<T> {
  /**
   * The account's cash at the end of the day, from a row carrying the
   * server's end-of-day (`DAY`) balance. Every posted row of a day carries the
   * same one, so any of them will do; none when no row does.
   */
  cashBalance: { amount: string; currency: string } | null
}

/**
 * Groups runs of consecutive rows that display the same date, in the order the
 * server returned them. The list is only grouped while it runs in date order,
 * so each day is one run; nothing here re-sorts or re-dates a row.
 */
export function groupActivitiesByDay<T>(
  items: T[],
  getActivity: (item: T) => ActivityDetails,
  getDisplayedDate: (activity: ActivityDetails) => string,
): ActivityDayGroup<T>[] {
  const groups: ActivityDayGroup<T>[] = []
  for (const item of items) {
    const activity = getActivity(item)
    const key = getDisplayedDate(activity)
    let group: ActivityDayGroup<T> | undefined = groups[groups.length - 1]
    if (group?.key !== key) {
      group = { key, items: [], cashBalance: null }
      groups.push(group)
    }
    group.items.push(item)
    if (
      !group.cashBalance &&
      activity.cashBalanceScope === 'DAY' &&
      activity.cashBalance != null &&
      activity.cashBalanceCurrency
    ) {
      group.cashBalance = {
        amount: activity.cashBalance,
        currency: activity.cashBalanceCurrency,
      }
    }
  }
  return groups
}
