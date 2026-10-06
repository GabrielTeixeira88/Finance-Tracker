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
    onSuccess: async () => {
      await client.invalidateQueries()
    },
  })
}
