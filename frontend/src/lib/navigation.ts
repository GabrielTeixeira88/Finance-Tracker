import { useSyncExternalStore } from 'react'
import type { Page } from '@/components/app-shell'

const paths: Record<Page, string> = {
  Overview: 'overview',
  Accounts: 'accounts',
  Account: 'account',
  Transactions: 'transactions',
  Budget: 'spending',
  Investments: 'investments',
  Performance: 'performance',
  'Net Worth': 'net-worth',
  Goals: 'goals',
  Reports: 'reports',
  Settings: 'settings',
}
const changed = 'finance-tracker:navigation'
function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  window.addEventListener('popstate', listener)
  window.addEventListener(changed, listener)
  return () => {
    window.removeEventListener('hashchange', listener)
    window.removeEventListener('popstate', listener)
    window.removeEventListener(changed, listener)
  }
}
function snapshot() {
  return window.location.hash
}
export function readRoute(hash = snapshot()) {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?')
  const params = new URLSearchParams(search)
  const page =
    (Object.entries(paths).find(([, slug]) => slug === path)?.[0] as
      Page | undefined) ?? 'Overview'
  return { page, accountId: params.get('account') ?? undefined, params }
}
function write(hash: string, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', hash)
  window.dispatchEvent(new Event(changed))
}
export function navigateTo(
  page: Page,
  accountId?: string,
  values: Record<string, string> = {},
) {
  const params = new URLSearchParams(values)
  if (accountId) params.set('account', accountId)
  write(`#/${paths[page]}${params.size ? `?${params}` : ''}`)
}
export function useRoute() {
  return readRoute(useSyncExternalStore(subscribe, snapshot, () => ''))
}

/** Replace typing/filter state without creating a history entry per keystroke. */
export function rememberLedgerFilters(values: Record<string, string>) {
  const route = readRoute()
  if (!['Transactions', 'Account'].includes(route.page)) return
  const params = new URLSearchParams(
    Object.entries(values).filter(([, value]) => value),
  )
  if (route.accountId) params.set('account', route.accountId)
  params.set('view', 'activity')
  window.history.replaceState(null, '', `#/${paths[route.page]}?${params}`)
}

/** Section state belongs to the destination; history restores it on Back. */
export function useSection<T extends string>(
  allowed: readonly T[],
  fallback: T,
  parameter = 'view',
) {
  const route = useRoute()
  const candidate = route.params.get(parameter) as T | null
  const value = candidate && allowed.includes(candidate) ? candidate : fallback
  return [
    value,
    (next: T) => {
      const params = new URLSearchParams(readRoute().params)
      params.set(parameter, next)
      navigateTo(route.page, route.accountId, Object.fromEntries(params))
    },
  ] as const
}
