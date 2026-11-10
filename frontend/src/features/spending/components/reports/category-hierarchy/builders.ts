// SPDX-License-Identifier: AGPL-3.0-only
// Flat-category adaptation of Wealthfolio 92b4647 category-hierarchy/builders.ts.
// Category hierarchy remains postponed. Preserve signed refunds and exact Decimal strings.
import type { Category } from '@/lib/api'
import type { BudgetCategoryRow, BudgetGroupRow } from '../../../types/budget'
import { decimalUnits, sumMoney, subtractMoney } from '@/lib/money'
import { exactAbs, exactRatio } from '../../../compat'
import type { FormattingApi } from '@/features/holdings/number-formatters'
export type CategorySort = 'spent' | 'delta' | 'name'
export type TaxonomyCategory = Category & { parentId: null; taxonomyId: string }
export type CategoryBreakdownRow = {
  categoryId: string
  amount: string
  count: number
}
export interface NodeRow {
  id: string
  name: string
  color: string | null
  icon: string | null
  parentId: string | null
  spent: string
  priorSpent: string
  budgeted: string
  children: NodeRow[]
}
export type GroupNode = Omit<NodeRow, 'parentId'>
export const DIRECT_ROW_ID = '__direct__'
export function buildTree({
  breakdown,
  priorBreakdown,
  budgetRows,
  taxonomyCategories,
  sort,
  compareNames,
}: {
  breakdown: CategoryBreakdownRow[]
  priorBreakdown: CategoryBreakdownRow[]
  budgetRows: BudgetCategoryRow[]
  taxonomyCategories: TaxonomyCategory[]
  sort: CategorySort
  compareNames: (a: string, b: string) => number
  directLabel: string
}): NodeRow[] {
  const ids = new Set(
    [...breakdown, ...priorBreakdown]
      .map((row) => row.categoryId)
      .concat(budgetRows.map((row) => row.categoryId)),
  )
  return [...ids]
    .map((id) => {
      const meta = taxonomyCategories.find((row) => row.id === id),
        budget = budgetRows.find((row) => row.categoryId === id)
      return {
        id,
        name: meta?.name ?? id,
        color: meta?.color ?? null,
        icon: meta?.icon ?? null,
        parentId: null,
        spent: sumMoney(
          breakdown
            .filter((row) => row.categoryId === id)
            .map((row) => row.amount),
        ),
        priorSpent: sumMoney(
          priorBreakdown
            .filter((row) => row.categoryId === id)
            .map((row) => row.amount),
        ),
        budgeted: budget?.active
          ? sumMoney([budget.target, budget.rolloverIn])
          : '0',
        children: [],
      }
    })
    .filter((row) =>
      [row.spent, row.priorSpent, row.budgeted].some(
        (value) => decimalUnits(value) !== 0n,
      ),
    )
    .sort((a, b) => {
      if (sort === 'name') return compareNames(a.name, b.name)
      const left = decimalUnits(
          sort === 'spent'
            ? a.spent
            : exactAbs(subtractMoney(a.spent, a.priorSpent)),
        ),
        right = decimalUnits(
          sort === 'spent'
            ? b.spent
            : exactAbs(subtractMoney(b.spent, b.priorSpent)),
        )
      return left > right ? -1 : left < right ? 1 : compareNames(a.name, b.name)
    })
}
export function buildGroupWeights({
  tree,
  groupRows,
  budgetRows,
  otherLabel = 'Other',
}: {
  tree: NodeRow[]
  groupRows: BudgetGroupRow[]
  budgetRows: BudgetCategoryRow[]
  otherLabel?: string
}): GroupNode[] {
  const groups = groupRows.map((row) => ({
    ...row.group,
    children: tree.filter(
      (node) =>
        budgetRows.find((row) => row.categoryId === node.id)?.groupId ===
        row.group.id,
    ),
  }))
  const assigned = new Set(
    groups.flatMap((row) => row.children.map((child) => child.id)),
  )
  const other = tree.filter((node) => !assigned.has(node.id))
  if (other.length)
    groups.push({
      id: '__other__',
      name: otherLabel,
      color: null,
      icon: null,
      key: 'other',
      sortOrder: 999,
      isSystem: true,
      createdAt: '',
      updatedAt: '',
      children: other,
    })
  return groups.map((group) => ({
    ...group,
    spent: sumMoney(group.children.map((row) => row.spent)),
    priorSpent: sumMoney(group.children.map((row) => row.priorSpent)),
    budgeted: sumMoney(group.children.map((row) => row.budgeted)),
  }))
}
export function formatDelta(
  delta: string,
  baseline: string,
  formatting: Pick<FormattingApi, 'formatPercent'>,
) {
  if (decimalUnits(delta) === 0n) return '—'
  if (decimalUnits(baseline) <= 0n) return '—'
  return `${decimalUnits(delta) > 0n ? '↑' : '↓'} ${formatting.formatPercent(exactRatio(exactAbs(delta), baseline))}`
}
