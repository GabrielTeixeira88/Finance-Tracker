import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '@/lib/api'

export function useWrite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      data,
    }: {
      path: string
      method?: string
      data?: unknown
    }) =>
      request(path, {
        method,
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
    onSuccess: async (_result, variables) => {
      // Target configuration never changes the ledger. Financial mutations continue
      // to refresh all existing dependent views, including spending and refunds.
      await client.invalidateQueries(
        variables.path.startsWith('/budgets/') ? { queryKey: ['budgets'] } : {},
      )
    },
  })
}
