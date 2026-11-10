import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '@/lib/api'

/** One database-backed reporting preference; never a record-currency rewrite. */
export function useReportingCurrency() {
  const query = useQuery({
    queryKey: ['settings', 'preferences'],
    queryFn: async () =>
      z
        .object({ reporting_currency: z.string().regex(/^[A-Z]{3}$/) })
        .parse(await request('/settings/preferences')),
  })
  return query.data?.reporting_currency ?? 'BRL'
}
