import { budgetFixture } from './budget'
import type { BudgetWorkspace } from '@/features/spending/budget-adapter'
import type { SpendingWorkspaceData } from '@/features/spending/api'
import { dayAfter } from '@/lib/spending-period'
export function spendingFixture(empty = false): SpendingWorkspaceData {
  const data = budgetFixture(),
    expense = empty ? '0' : data.summary.expenses,
    income = empty ? '0' : '1000'
  return {
    currency: 'BRL',
    start: '2026-09-01',
    end_exclusive: '2026-10-01',
    as_of: '2026-10-10',
    previous_start: '2026-08-02',
    previous_end_exclusive: '2026-09-01',
    current: {
      income,
      expenses: expense,
      gross_expenses: expense,
      refunds: '0',
      count: empty ? 0 : 1,
      average_transaction: empty ? null : expense,
      to_savings: '0',
      from_savings: '0',
      net_saved: '0',
      net_flow: empty ? '0' : '349.876544',
      after_savings: empty ? '0' : '349.876544',
      change: empty ? '0' : '250.123456',
      change_percent: empty ? null : '62.530864',
    },
    previous: {
      income: '1000',
      expenses: '400',
      gross_expenses: '400',
      refunds: '0',
      count: 1,
      average_transaction: '400',
    },
    daily: Array.from({ length: 30 }, (_, index) => ({
      date: dayAfter('2026-09-01', index),
      income: !empty && index === 0 ? '1000' : '0',
      spending: !empty && index === 9 ? expense : '0',
      to_savings: '0',
      from_savings: '0',
      net_flow: '0',
      after_savings: '0',
    })),
    categories: empty
      ? []
      : [
          {
            category_id: 'c',
            name: 'Synthetic Groceries',
            current: expense,
            previous: '400',
            change: '250.123456',
            change_percent: '62.530864',
            history: [
              { month: '2026-08', amount: '400' },
              { month: '2026-09', amount: expense },
            ],
          },
        ],
    weekdays: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      amount: weekday === 3 ? expense : '0',
    })),
    recent_daily: '0',
    other_currencies: [],
    income_sources: empty
      ? []
      : [{ category_id: null, name: 'Salary', amount: income }],
    saving_destinations: [],
  }
}
export function editorFixture(empty = false): BudgetWorkspace {
  const report = budgetFixture()
  if (empty) {
    report.categories = []
    report.groups = []
    report.daily = []
    report.payees = []
    for (const key of [
      'target',
      'carryover',
      'available',
      'income',
      'expenses',
      'net_flow',
      'budgeted_spending',
      'unbudgeted_spending',
      'remaining',
    ] as const)
      report.summary[key] = '0'
  }
  return {
    report,
    groups: empty
      ? []
      : [
          {
            id: 'g',
            name: 'Essentials',
            sort_order: 0,
            color: '#5989AB',
            icon: 'Home',
          },
        ],
    targets: empty ? [] : [{ id: 't', category_id: 'c', currency: 'BRL' }],
    versions: empty
      ? []
      : [
          {
            id: 'base',
            target_id: 't',
            month: '2026-01-01',
            amount: '500',
            active: true,
            rollover_enabled: true,
            group_id: 'g',
            sort_order: 7,
          },
        ],
    overrides: [],
  }
}
