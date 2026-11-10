import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDemoDate, localDate, request } from '@/lib/api'
import { goalDetailSchema, type GoalDetail } from '@/lib/wealth-api'

export const goalDate = () => getDemoDate() ?? localDate()
export type GoalType =
  'education' | 'home' | 'car' | 'wedding' | 'custom_save_up'
export type PlanDraft = {
  target: string
  deadline: string | null
  monthly: string
  goal_type: GoalType
}
export const asOf = () => '?as_of=' + goalDate()
export const getSavedGoal = (id: string, signal?: AbortSignal) =>
  request('/goals/' + id + asOf(), { signal }).then((value) =>
    goalDetailSchema.parse(value),
  )
export const getPreview = (
  id: string,
  draft: PlanDraft,
  signal?: AbortSignal,
) =>
  request('/goals/' + id + '/preview' + asOf(), {
    method: 'POST',
    body: JSON.stringify(draft),
    signal,
  }).then((value) => goalDetailSchema.parse(value))
export function useGoalWrite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      path,
      data,
      method = 'POST',
    }: {
      path: string
      data?: unknown
      method?: string
    }) =>
      request(path, {
        method,
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['goals'] }),
        client.invalidateQueries({ queryKey: ['goal'] }),
        client.invalidateQueries({ queryKey: ['goal-allocations'] }),
      ])
    },
  })
}
export function planDraft(detail: GoalDetail): PlanDraft {
  return {
    target: detail.goal.target,
    deadline: detail.goal.deadline,
    monthly: detail.plan.monthly,
    goal_type: detail.plan.goal_type as GoalType,
  }
}
