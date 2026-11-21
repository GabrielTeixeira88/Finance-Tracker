import { useQuery } from '@tanstack/react-query'
import { getGoals } from '@/lib/wealth-api'
import { sourceGoal } from '../compat'
export function useGoals() {
  const query = useQuery({ queryKey: ['goals'], queryFn: getGoals })
  const goals = (query.data ?? []).map(sourceGoal)
  return {
    ...query,
    goals,
    details: query.data ?? [],
    active: goals.filter(
      (g) =>
        ['active', 'paused'].includes(g.statusLifecycle) &&
        !['at_risk', 'off_track'].includes(g.statusHealth),
    ),
    atRisk: goals.filter(
      (g) =>
        g.statusLifecycle === 'active' &&
        ['at_risk', 'off_track'].includes(g.statusHealth),
    ),
    achieved: goals.filter((g) => g.statusLifecycle === 'achieved'),
    archived: goals.filter((g) => g.statusLifecycle === 'archived'),
  }
}
