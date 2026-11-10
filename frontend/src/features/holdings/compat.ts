import { useCallback, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import {
  navigateTo,
  readRoute,
  useRoute,
  updateRouteParams,
} from '@/lib/navigation'
import { getAccounts } from '@/lib/api'
import { decimalUnits, unitsToMoney } from '@/lib/money'
import type { Exact, Holding } from './types'
export const HoldingType = { CASH: 'CASH', SECURITY: 'SECURITY' } as const
export const profilePreferenceKey = (key: string) => key
export const usesLegacyPreferences = () => false
export type NavigateFunction = (
  path: string,
  options?: { state?: unknown },
) => void
export function useNavigate(): NavigateFunction {
  return useCallback((path: string) => {
    const route = readRoute()
    if (path.startsWith('/holdings/'))
      navigateTo('Investments', route.accountId, {
        ...Object.fromEntries(route.params),
        view: 'Holdings',
        asset: decodeURIComponent(path.slice('/holdings/'.length)),
      })
    else if (path.startsWith('/account/'))
      navigateTo('Account', decodeURIComponent(path.slice('/account/'.length)))
  }, [])
}
export function useBalancePrivacy() {
  return { isBalanceHidden: useFinancialPrivacy().hidden }
}
export function exactAdd(a: Exact, b: Exact): Exact {
  return a === null || b === null
    ? null
    : unitsToMoney(decimalUnits(a) + decimalUnits(b))
}
export function exactSubtract(a: Exact, b: Exact): Exact {
  return a === null || b === null
    ? null
    : unitsToMoney(decimalUnits(a) - decimalUnits(b))
}
export function compareExact(a: Exact, b: Exact): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  return decimalUnits(a) < decimalUnits(b)
    ? -1
    : decimalUnits(a) > decimalUnits(b)
      ? 1
      : 0
}
export function getBaseHoldingPerformancePercent(
  holding: Holding,
  metric: 'unrealizedGain' | 'realizedGain' | 'totalGain' | 'totalReturn',
): Exact {
  return holding[`${metric}Pct`]
}
// Options are not a supported domain instrument; no option data is inferred.
export function parseOccSymbol(_symbol: string): { underlying: string } | null {
  void _symbol
  return null
}
export function formatOptionSubtitle(..._values: unknown[]): string | null {
  void _values
  return null
}
export const readProfilePreference = (_key: string): null => {
  void _key
  return null
}
export const useHapticFeedback = () => ({ triggerHaptic: () => {} })
const mobileQuery = '(max-width: 767px)'
function subscribeMobile(listener: () => void) {
  const media = matchMedia(mobileQuery)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
export function useIsMobileViewport() {
  return useSyncExternalStore(
    subscribeMobile,
    () => matchMedia(mobileQuery).matches,
    () => false,
  )
}
export function useAccounts(_options?: {
  filterActive?: boolean
  includeArchived?: boolean
}) {
  void _options
  const query = useQuery({
    queryKey: ['accounts'],
    queryFn: ({ signal }) => getAccounts(signal),
  })
  return {
    accounts: query.data?.filter((a) => a.type === 'INVESTMENT') ?? [],
    isLoading: query.isPending,
  }
}
// Named portfolios were explicitly postponed. No backend success is fabricated.
export function usePortfolios(): {
  data: { id: string; name: string }[]
  isSuccess: false
} {
  return { data: [], isSuccess: false }
}
export const HOLDING_CATEGORY_FILTERS = [
  { id: 'investments', label: 'Investments' },
  { id: 'assets', label: 'Assets' },
  { id: 'liabilities', label: 'Liabilities' },
] as const
export function useSearchParams() {
  const route = useRoute()
  const set = useCallback(
    (
      next:
        | Record<string, string>
        | URLSearchParams
        | ((previous: URLSearchParams) => URLSearchParams),
      options?: { replace?: boolean },
    ) => {
      const current = new URLSearchParams(readRoute().params)
      const result =
        typeof next === 'function'
          ? next(current)
          : next instanceof URLSearchParams
            ? next
            : new URLSearchParams({ ...Object.fromEntries(current), ...next })
      updateRouteParams(result, options?.replace)
    },
    [],
  )
  return [new URLSearchParams(route.params), set] as const
}
