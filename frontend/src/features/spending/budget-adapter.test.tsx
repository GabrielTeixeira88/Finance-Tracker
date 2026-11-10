import './i18n'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { budgetFixture } from '@/test/fixtures/synthetic/budget'
import {
  sourceBudgetSnapshot,
  useBudgetActions,
  type BudgetWorkspace,
} from './budget-adapter'

export function sourceBudgetFixture(): BudgetWorkspace {
  const report = budgetFixture()
  report.month = '2026-09'
  report.categories[0] = {
    ...report.categories[0],
    category_id: 'c',
    target_id: 'target',
    group_id: 'b',
    target: '700',
    carryover: '-25',
    available: '675',
    remaining: '75',
    active: true,
    override: true,
    spent: '600',
  }
  return {
    report,
    targets: [{ id: 'target', category_id: 'c', currency: 'BRL' }],
    groups: [
      { id: 'a', name: 'Needs', sort_order: 0, color: '#5989AB', icon: 'Home' },
      { id: 'b', name: 'Wants', sort_order: 1 },
    ],
    versions: [
      {
        id: 'base',
        target_id: 'target',
        month: '2026-01-01',
        amount: '500',
        active: true,
        rollover_enabled: true,
        group_id: 'a',
        sort_order: 17,
      },
      {
        id: 'future',
        target_id: 'target',
        month: '2026-10-01',
        amount: '900',
        active: true,
        rollover_enabled: false,
        group_id: 'a',
        sort_order: 20,
      },
    ],
    overrides: [
      {
        id: 'override',
        target_id: 'target',
        month: '2026-09-01',
        amount: '700',
        active: true,
        rollover_enabled: false,
        group_id: 'b',
        sort_order: 9,
      },
    ],
  }
}

it('maps source monthly/default views without flattening versions, overrides or signed rollover', () => {
  const source = sourceBudgetFixture()
  const monthly = sourceBudgetSnapshot(
    source,
    [{ id: 'c', name: 'Groceries', color: '#5989AB', icon: 'ShoppingCart' }],
    'monthly',
  )
  const current = monthly.computed.groupRows.find(
    (row) => row.group.id === 'b',
  )!
  expect(current.plannedTotal).toBe('675.000000')
  expect(current.categories[0]).toMatchObject({
    target: '700',
    rolloverIn: '-25',
    remaining: '75.000000',
    icon: 'ShoppingCart',
  })
  const defaults = sourceBudgetSnapshot(
    source,
    [{ id: 'c', name: 'Groceries' }],
    'setup',
  )
  expect(
    defaults.computed.groupRows.find((row) => row.group.id === 'a')!
      .categories[0],
  ).toMatchObject({ target: '500', rolloverEnabled: true, rolloverIn: '0' })
  expect(source.overrides[0].amount).toBe('700')
})

it('preserves exact configuration metadata on inline amount-only writes in both scopes', async () => {
  const fetch = vi.fn(async (_path: string, _init?: RequestInit) => {
    void _path
    void _init
    return new Response('{}')
  })
  vi.stubGlobal('fetch', fetch)
  for (const mode of ['monthly', 'setup'] as const) {
    const data = sourceBudgetFixture()
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const hook = renderHook(() => useBudgetActions(data, mode), { wrapper })
    const snapshot = sourceBudgetSnapshot(
      data,
      [{ id: 'c', name: 'Groceries' }],
      mode,
    )
    const row = snapshot.computed.groupRows
      .flatMap((group) => group.categories)
      .find((item) => item.categoryId === 'c')!
    await act(async () =>
      hook.result.current.saveCategory(row, '9007199254740993.123456'),
    )
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledTimes(mode === 'monthly' ? 1 : 2),
    )
    const [path, init] = fetch.mock.calls.at(-1)!
    expect(path).toBe('/api/budgets/targets')
    expect(JSON.parse(String(init?.body))).toEqual({
      category_id: 'c',
      currency: 'BRL',
      month: '2026-09',
      scope: mode === 'monthly' ? 'month' : 'default',
      amount: '9007199254740993.123456',
      active: true,
      rollover_enabled: mode === 'setup',
      group_id: mode === 'monthly' ? 'b' : 'a',
      sort_order: mode === 'monthly' ? 9 : 17,
    })
    hook.unmount()
  }
})
