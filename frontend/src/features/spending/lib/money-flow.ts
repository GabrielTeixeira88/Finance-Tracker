import type { SpendingWorkspaceData } from '../api'
import type { Category } from '@/lib/api'
import type { BudgetSnapshot } from '../types/budget'
import { decimalUnits, unitsToMoney, sumMoney } from '@/lib/money'
import { safePercent } from '../compat'
export type MoneyFlowNodeKind =
  | 'income'
  | 'from-savings'
  | 'refunds'
  | 'shortfall'
  | 'total'
  | 'group'
  | 'uncategorized'
  | 'saved'
  | 'surplus'
  | 'category'
  | 'savings-category'
  | 'more'
  | 'net'
  | 'subcategory'
  | 'direct'
export type MoneyFlowNode = {
  id: string
  name: string
  kind: MoneyFlowNodeKind
  value: number
  amount: string
  color: string
  column: number
  categoryId?: string
  parentId?: string
  members?: { name: string; value: string }[]
  netRefunds?: string
  subcategories?: unknown[]
}
export type MoneyFlowGraph = {
  nodes: MoneyFlowNode[]
  links: { source: string; target: string; value: number }[]
  totals: {
    income: number
    fromSavings: number
    total: number
    incomeAmount: string
    totalAmount: string
  }
  rootId?: string
}
export const isFocusable = (node: MoneyFlowNode) =>
  node.kind === 'group' || node.kind === 'saved'
/** Exact financial projection. Only dimensionless Sankey coordinates cross to Number. */
export function moneyFlowGraph(
  report: SpendingWorkspaceData,
  categories: Category[],
  budget: BudgetSnapshot | undefined,
  label: (key: string) => string,
): MoneyFlowGraph {
  const nodes: MoneyFlowNode[] = [],
    links: MoneyFlowGraph['links'] = []
  const expenses = report.categories.filter(
    (row) => decimalUnits(row.current) > 0n,
  )
  const refunds = report.categories.filter(
    (row) => decimalUnits(row.current) < 0n,
  )
  const gross = sumMoney(expenses.map((row) => row.current))
  const returned = unitsToMoney(
    -decimalUnits(sumMoney(refunds.map((row) => row.current))),
  )
  const inflow = sumMoney([
    report.current.income,
    report.current.from_savings,
    returned,
  ])
  const outflow = sumMoney([gross, report.current.to_savings])
  const shortfall =
    decimalUnits(outflow) > decimalUnits(inflow)
      ? unitsToMoney(decimalUnits(outflow) - decimalUnits(inflow))
      : '0'
  const surplus =
    decimalUnits(inflow) > decimalUnits(outflow)
      ? unitsToMoney(decimalUnits(inflow) - decimalUnits(outflow))
      : '0'
  const total = sumMoney([inflow, shortfall])
  const add = (
    id: string,
    name: string,
    amount: string,
    kind: MoneyFlowNodeKind,
    column: number,
    color = 'var(--spending-deep)',
    categoryId?: string,
    parentId?: string,
  ) => {
    if (decimalUnits(amount) <= 0n) return
    nodes.push({
      id,
      name,
      amount,
      value: safePercent(amount, total),
      kind,
      column,
      color,
      categoryId,
      parentId,
    })
  }
  const link = (source: string, target: string, amount: string) => {
    if (decimalUnits(amount) > 0n)
      links.push({ source, target, value: safePercent(amount, total) })
  }
  add('total', label('total'), total, 'total', 1, 'var(--muted-foreground)')
  for (const row of report.income_sources) {
    const id = 'income-' + (row.category_id ?? 'none')
    add(id, row.name, row.amount, 'income', 0)
    link(id, 'total', row.amount)
  }
  for (const [id, amount, kind] of [
    ['fromSavings', report.current.from_savings, 'from-savings'],
    ['refunds', returned, 'refunds'],
    ['shortfall', shortfall, 'shortfall'],
  ] as const) {
    add(
      id,
      label(id),
      amount,
      kind,
      0,
      kind === 'shortfall' ? 'var(--destructive)' : 'var(--success)',
    )
    link(id, 'total', amount)
  }
  const groupByCategory = new Map(
    budget?.computed.groupRows.flatMap((group) =>
      group.categories.map((row) => [row.categoryId, group.group] as const),
    ) ?? [],
  )
  const groups = new Map<
    string,
    { name: string; color: string; amounts: string[] }
  >()
  for (const row of expenses) {
    const group = groupByCategory.get(row.category_id ?? '')
    const id = group?.id ?? 'other'
    const item = groups.get(id) ?? {
      name: group?.name ?? label('other'),
      color: group?.color ?? 'var(--spending-deep)',
      amounts: [],
    }
    item.amounts.push(row.current)
    groups.set(id, item)
  }
  for (const [id, group] of groups) {
    const amount = sumMoney(group.amounts)
    add('group-' + id, group.name, amount, 'group', 2, group.color)
    link('total', 'group-' + id, amount)
  }
  for (const row of expenses) {
    const group = groupByCategory.get(row.category_id ?? '')
    const id = 'category-' + (row.category_id ?? 'none')
    const parent = 'group-' + (group?.id ?? 'other')
    add(
      id,
      row.name,
      row.current,
      row.category_id ? 'category' : 'uncategorized',
      3,
      categories.find((c) => c.id === row.category_id)?.color ??
        'var(--spending-deep)',
      row.category_id ?? '__uncategorized__',
      parent,
    )
    link(parent, id, row.current)
  }
  add(
    'saved',
    label('toSavings'),
    report.current.to_savings,
    'saved',
    2,
    'var(--success)',
  )
  link('total', 'saved', report.current.to_savings)
  for (const row of report.saving_destinations) {
    const id = 'savings-' + row.account_id
    add(
      id,
      row.name,
      row.amount,
      'savings-category',
      3,
      'var(--success)',
      undefined,
      'saved',
    )
    link('saved', id, row.amount)
  }
  add('surplus', label('surplus'), surplus, 'surplus', 2, 'var(--success)')
  link('total', 'surplus', surplus)
  return {
    nodes,
    links,
    totals: {
      income: safePercent(report.current.income, total),
      fromSavings: safePercent(report.current.from_savings, total),
      total: decimalUnits(total) > 0n ? 1 : 0,
      incomeAmount: report.current.income,
      totalAmount: total,
    },
  }
}
export function focusMoneyFlow(
  graph: MoneyFlowGraph,
  id: string,
): MoneyFlowGraph {
  const root = graph.nodes.find((node) => node.id === id)
  if (!root) return graph
  const children = graph.nodes.filter((node) => node.parentId === id)
  return {
    ...graph,
    rootId: id,
    nodes: [
      { ...root, column: 0 },
      ...children.map((node) => ({ ...node, column: 1 })),
    ],
    links: graph.links.filter((link) => link.source === id),
  }
}
