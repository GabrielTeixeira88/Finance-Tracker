import i18n from '@/lib/i18n'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { request, type Category } from '@/lib/api'
import { budgetSchema, shiftMonth } from '@/lib/budget-api'
import { sumMoney, decimalUnits, subtractMoney } from '@/lib/money'
import { groupSchema, type SpendingWorkspaceData } from './api'
import type {
  BudgetCategoryRow,
  BudgetGroup,
  BudgetSnapshot,
  BudgetTarget,
} from './types/budget'

const configuration = z.object({
  id: z.string(),
  target_id: z.string(),
  month: z.string(),
  amount: z.string(),
  active: z.boolean(),
  rollover_enabled: z.boolean(),
  group_id: z.string().nullable(),
  sort_order: z.number().int(),
})
export const budgetWorkspaceSchema = z.object({
  report: budgetSchema,
  groups: z.array(groupSchema),
  targets: z.array(
    z.object({ id: z.string(), category_id: z.string(), currency: z.string() }),
  ),
  versions: z.array(configuration),
  overrides: z.array(configuration),
})
export type BudgetWorkspace = z.infer<typeof budgetWorkspaceSchema>
export function getBudgetWorkspace(
  month: string,
  currency: string,
  asOf: string,
  signal?: AbortSignal,
) {
  return request(
    '/budgets/workspace?' +
      new URLSearchParams({ month, currency, as_of: asOf }),
    { signal },
  ).then((data) => budgetWorkspaceSchema.parse(data))
}
export function sourceBudgetSnapshot(
  data: BudgetWorkspace,
  categories: Category[],
  mode: 'monthly' | 'setup',
  income?: SpendingWorkspaceData,
): BudgetSnapshot {
  const month = data.report.month
  const groups: BudgetGroup[] = data.groups.map((group) => ({
    id: group.id,
    name: group.name,
    key: group.id,
    color: group.color ?? null,
    icon: group.icon ?? null,
    sortOrder: group.sort_order,
    isSystem: false,
    createdAt: '',
    updatedAt: '',
  }))
  const targets: BudgetTarget[] = []
  const rows: BudgetCategoryRow[] = data.report.categories
    .filter((row) => row.category_id)
    .map((row) => {
      const meta = categories.find(
        (category) => category.id === row.category_id,
      )
      const defaults = data.versions
        .filter(
          (item) =>
            item.target_id === row.target_id && item.month.slice(0, 7) <= month,
        )
        .at(-1)
      const override = data.overrides.find(
        (item) => item.target_id === row.target_id,
      )
      const selected = mode === 'setup' ? defaults : (override ?? defaults)
      for (const [record, periodKey] of [
        [defaults, 'default'],
        [override, month],
      ] as const) {
        if (record)
          targets.push({
            id: record.target_id,
            periodKey,
            targetType: 'category',
            taxonomyId: 'spending_categories',
            categoryId: row.category_id,
            groupId: record.group_id,
            amount: record.amount,
            createdAt: '',
            updatedAt: '',
          })
      }
      const target = selected?.active ? selected.amount : '0'
      const carry = mode === 'monthly' ? row.carryover : '0'
      const available = sumMoney([target, carry])
      return {
        active: selected?.active ?? false,
        taxonomyId: 'spending_categories',
        categoryId: row.category_id!,
        groupId: selected?.group_id ?? null,
        parentId: null,
        name: row.name,
        color: meta?.color ?? null,
        icon: meta?.icon ?? null,
        target,
        actual: row.spent,
        rolloverIn: carry,
        rolloverOut: subtractMoney(available, row.spent),
        remaining: subtractMoney(available, row.spent),
        overspent: decimalUnits(row.spent) > decimalUnits(available),
        hasDefaultTarget: !!defaults,
        hasMonthOverride: mode === 'monthly' && !!override,
        rolloverEnabled: selected?.rollover_enabled ?? false,
      }
    })
  const virtual: BudgetGroup = {
    id: '__ungrouped__',
    name: 'Ungrouped',
    key: 'other',
    color: null,
    icon: 'MoreHorizontal',
    sortOrder: 100001,
    isSystem: true,
    createdAt: '',
    updatedAt: '',
  }
  const groupRows = [...groups, virtual]
    .map((group) => {
      const children = rows.filter((row) =>
        group.isSystem ? !row.groupId : row.groupId === group.id,
      )
      const base = sumMoney(children.map((row) => row.target))
      const carry = sumMoney(children.map((row) => row.rolloverIn))
      const actual = sumMoney(children.map((row) => row.actual))
      const planned = sumMoney([base, carry])
      return {
        group,
        categories: children,
        categoryTargetTotal: base,
        buffer: '0',
        plannedTotal: planned,
        actual,
        rolloverIn: carry,
        rolloverOut: subtractMoney(planned, actual),
        remaining: subtractMoney(planned, actual),
        overspent: decimalUnits(actual) > decimalUnits(planned),
        rolloverEnabled: false,
      }
    })
    .filter((row) => !row.group.isSystem || row.categories.length)
  return {
    state: { groups, targets, groupAssignments: [], rolloverSettings: [] },
    incomeSources:
      income?.income_sources.map((row) => ({
        name: row.name,
        amount: row.amount,
      })) ?? [],
    computed: {
      currency: data.report.currency,
      periodKey: month,
      fxAsOf: null,
      groupRows,
      ungroupedRows: [],
      incomeRows: [],
      totals: {
        spendingPlanned: sumMoney(groupRows.map((row) => row.plannedTotal)),
        spendingActual: data.report.summary.expenses,
        spendingRemaining: subtractMoney(
          sumMoney(groupRows.map((row) => row.plannedTotal)),
          data.report.summary.expenses,
        ),
        incomeActual: data.report.summary.income,
        groupBuffer: '0',
        rolloverIn: sumMoney(rows.map((row) => row.rolloverIn)),
        rolloverOut: sumMoney(rows.map((row) => row.rolloverOut)),
        overspentCount: rows.filter((row) => row.overspent).length,
      },
    },
  }
}

export type BudgetActions = {
  pending: boolean
  editDetails: (row: BudgetCategoryRow) => void
  error: Error | null
  saveCategory: (row: BudgetCategoryRow, value: string) => void
  removeOverride: (target: BudgetTarget | undefined) => void
  moveCategory: (categoryId: string, groupId: string) => void
  updateGroup: (
    id: string,
    patch: {
      sort_order?: number
      name?: string
      color?: string | null
      icon?: string | null
    },
  ) => void
  removeGroup: (id: string) => void
  rollover: (row: BudgetCategoryRow, enabled: boolean) => void
  toggleActive: (row: BudgetCategoryRow) => void
  copyPrevious: (source: string, overwrite: boolean) => void
  addGroup: () => void
}

export function useBudgetActions(
  data: BudgetWorkspace,
  mode: 'monthly' | 'setup',
): BudgetActions {
  const client = useQueryClient()
  const write = useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      body,
    }: {
      path: string
      method?: string
      body?: unknown
    }) =>
      request(path, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['budgets'] }),
  })
  const report = data.report
  const config = (
    categoryId: string,
    changes: Partial<{
      amount: string
      active: boolean
      rollover_enabled: boolean
      group_id: string | null
      sort_order: number
    }>,
  ) => {
    const row = report.categories.find(
      (item) => item.category_id === categoryId,
    )
    const base = data.versions
      .filter(
        (version) =>
          version.target_id === row?.target_id &&
          version.month.slice(0, 7) <= report.month,
      )
      .at(-1)
    const current =
      mode === 'setup'
        ? base
        : (data.overrides.find(
            (override) => override.target_id === row?.target_id,
          ) ?? base)
    write.mutate({
      path: '/budgets/targets',
      body: {
        category_id: categoryId,
        currency: report.currency,
        month: report.month,
        scope: mode === 'setup' ? 'default' : 'month',
        amount: current?.amount ?? '0',
        active: current?.active ?? true,
        rollover_enabled: current?.rollover_enabled ?? false,
        group_id: current?.group_id ?? null,
        sort_order: current?.sort_order ?? 0,
        ...changes,
      },
    })
  }
  return {
    editDetails: () => undefined,
    pending: write.isPending,
    error: write.error,
    saveCategory: (row, amount) => config(row.categoryId, { amount }),
    rollover: (row, enabled) =>
      config(row.categoryId, { rollover_enabled: enabled }),
    toggleActive: (row) => config(row.categoryId, { active: !row.active }),
    moveCategory: (id, groupId) =>
      config(id, { group_id: groupId === '__ungrouped__' ? null : groupId }),
    removeOverride: (target) => {
      if (target)
        write.mutate({
          path: `/budgets/targets/${target.id}/override?month=${report.month}`,
          method: 'DELETE',
        })
    },
    updateGroup: (id, patch) => {
      const group = data.groups.find((item) => item.id === id)
      if (group)
        write.mutate({
          path: '/budgets/groups/' + id,
          method: 'PUT',
          body: { name: group.name, sort_order: group.sort_order, ...patch },
        })
    },
    removeGroup: (id) =>
      write.mutate({ path: '/budgets/groups/' + id, method: 'DELETE' }),
    addGroup: () =>
      write.mutate({
        path: '/budgets/groups',
        body: {
          name: data.groups.some(
            (group) => group.name === i18n.t('spendingMigration:newGroup'),
          )
            ? i18n.t('spendingMigration:newGroup') +
              ' ' +
              (data.groups.length + 1)
            : i18n.t('spendingMigration:newGroup'),
          sort_order: data.groups.length,
          icon: 'Folder',
        },
      }),
    copyPrevious: (source, replace_existing) => {
      if (source === shiftMonth(report.month, -1))
        write.mutate({
          path: '/budgets/copy-month',
          body: {
            month: report.month,
            currency: report.currency,
            replace_existing,
          },
        })
    },
  }
}
