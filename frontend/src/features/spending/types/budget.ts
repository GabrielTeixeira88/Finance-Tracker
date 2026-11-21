// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 types/budget.ts; money is exact decimal strings.
export type BudgetTargetType = 'category' | 'group_buffer'
export type BudgetRolloverTargetType = 'category' | 'group'

export interface BudgetGroup {
  id: string
  name: string
  key: string
  color: string | null
  icon: string | null
  sortOrder: number
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface NewBudgetGroup {
  id?: string
  name: string
  key?: string
  color?: string | null
  icon?: string | null
  sortOrder?: string
  isSystem?: boolean
}

export interface UpdateBudgetGroup {
  name?: string
  color?: string | null
  icon?: string | null
  sortOrder?: string
}

export interface BudgetGroupAssignment {
  id: string
  groupId: string
  taxonomyId: string
  categoryId: string
  createdAt: string
  updatedAt: string
}

export interface BudgetTarget {
  id: string
  periodKey: string
  targetType: BudgetTargetType
  taxonomyId: string | null
  categoryId: string | null
  groupId: string | null
  amount: string
  createdAt: string
  updatedAt: string
}

export interface NewBudgetTarget {
  id?: string
  periodKey: string
  targetType: BudgetTargetType
  taxonomyId?: string | null
  categoryId?: string | null
  groupId?: string | null
  amount: string
}

export interface BudgetRolloverSetting {
  id: string
  targetType: BudgetRolloverTargetType
  taxonomyId: string | null
  categoryId: string | null
  groupId: string | null
  enabled: boolean
  startMonth: string
  startingBalance: string
  createdAt: string
  updatedAt: string
}

export interface NewBudgetRolloverSetting {
  id?: string
  targetType: BudgetRolloverTargetType
  taxonomyId?: string | null
  categoryId?: string | null
  groupId?: string | null
  enabled?: boolean
  startMonth: string
  startingBalance: string
}

export interface BudgetCategoryRow {
  active: boolean
  taxonomyId: string
  categoryId: string
  groupId: string | null
  parentId: string | null
  name: string
  color: string | null
  icon: string | null
  target: string
  actual: string
  rolloverIn: string
  rolloverOut: string
  remaining: string
  overspent: boolean
  hasDefaultTarget: boolean
  hasMonthOverride: boolean
  rolloverEnabled: boolean
}

export interface BudgetGroupRow {
  group: BudgetGroup
  categoryTargetTotal: string
  buffer: string
  plannedTotal: string
  actual: string
  rolloverIn: string
  rolloverOut: string
  remaining: string
  overspent: boolean
  rolloverEnabled: boolean
  categories: BudgetCategoryRow[]
}

export interface BudgetTotals {
  spendingPlanned: string
  spendingActual: string
  spendingRemaining: string
  incomeActual: string
  groupBuffer: string
  rolloverIn: string
  rolloverOut: string
  overspentCount: number
}

export interface BudgetSnapshot {
  state: {
    groups: BudgetGroup[]
    groupAssignments: BudgetGroupAssignment[]
    targets: BudgetTarget[]
    rolloverSettings: BudgetRolloverSetting[]
  }
  incomeSources: { name: string; amount: string }[]
  computed: {
    currency: string
    periodKey: string
    fxAsOf: string | null
    groupRows: BudgetGroupRow[]
    ungroupedRows: BudgetCategoryRow[]
    incomeRows: BudgetCategoryRow[]
    totals: BudgetTotals
  }
}
