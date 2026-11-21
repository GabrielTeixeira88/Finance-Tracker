import './i18n'
import { it, expect } from 'vitest'
import {
  spendingFixture,
  editorFixture,
} from '@/test/fixtures/synthetic/spending-workspace'
import { moneyFlowGraph, focusMoneyFlow } from './lib/money-flow'
import { sourceBudgetSnapshot } from './budget-adapter'
import { eventAggregate, type EventSpendingSummary } from './lib/event-adapter'
import { buildTree } from './components/reports/category-hierarchy/builders'
it('keeps exact money-flow labels and separate saving/return/refund flows, with balanced coordinates', () => {
  const report = spendingFixture()
  report.current.income = '1000'
  report.income_sources = [
    { category_id: null, name: 'Salary', amount: '1000' },
  ]
  report.current.to_savings = '500'
  report.current.from_savings = '100'
  report.saving_destinations = [
    { account_id: 'save', name: 'Savings', amount: '500' },
  ]
  report.categories = [
    {
      category_id: 'c',
      name: 'Groceries',
      current: '200',
      previous: '0',
      change: '200',
      change_percent: null,
      history: [],
    },
    {
      category_id: 'r',
      name: 'Returned item',
      current: '-50',
      previous: '0',
      change: '-50',
      change_percent: null,
      history: [],
    },
  ]
  const graph = moneyFlowGraph(report, [], undefined, (key) => key)
  expect(graph.nodes.find((row) => row.id === 'total')?.amount).toBe(
    '1150.000000',
  )
  expect(graph.nodes.find((row) => row.id === 'surplus')?.amount).toBe(
    '450.000000',
  )
  expect(graph.nodes.find((row) => row.id === 'saved')?.amount).toBe('500')
  const totalIn = graph.links
    .filter((link) => link.target === 'total')
    .reduce((sum, link) => sum + link.value, 0)
  const totalOut = graph.links
    .filter((link) => link.source === 'total')
    .reduce((sum, link) => sum + link.value, 0)
  expect(totalIn).toBeCloseTo(totalOut, 5)
  const focused = focusMoneyFlow(graph, 'saved')
  expect(focused.nodes.map((row) => row.name)).toEqual(['toSavings', 'Savings'])
})
it('does not lose huge authoritative monetary labels when drawing normalized coordinates', () => {
  const report = spendingFixture()
  report.income_sources = [
    { category_id: null, name: 'Income', amount: '9007199254740993.123456' },
  ]
  report.current.income = '9007199254740993.123456'
  const graph = moneyFlowGraph(report, [], undefined, (key) => key)
  expect(graph.nodes.find((row) => row.kind === 'income')?.amount).toBe(
    '9007199254740993.123456',
  )
  expect(
    graph.nodes.every(
      (row) => Number.isFinite(row.value) && row.value >= 0 && row.value <= 1,
    ),
  ).toBe(true)
})
it('retains negative category refunds in the source table and signed rollover in available targets', () => {
  const data = editorFixture()
  const snapshot = sourceBudgetSnapshot(
    data,
    [{ id: 'c', name: 'Groceries' }],
    'monthly',
  )
  const tree = buildTree({
    breakdown: [{ categoryId: 'c', amount: '-100.123456', count: 1 }],
    priorBreakdown: [],
    budgetRows: snapshot.computed.groupRows.flatMap((row) => row.categories),
    taxonomyCategories: [
      {
        id: 'c',
        name: 'Groceries',
        parentId: null,
        taxonomyId: 'spending_categories',
      },
    ],
    sort: 'spent',
    compareNames: (a, b) => a.localeCompare(b),
    directLabel: 'Direct',
  })
  expect(tree[0].spent).toBe('-100.123456')
  expect(tree[0].budgeted).toBe('600.000000')
})
it('uses exact non-event recorded dates as a descriptive baseline and leaves absent coverage unavailable', () => {
  const report = spendingFixture()
  report.daily = report.daily
    .slice(0, 3)
    .map((row, index) => ({ ...row, spending: ['10', '30', '20'][index] }))
  const event: EventSpendingSummary = {
    eventId: 'e',
    eventName: 'Course',
    eventTypeId: 'EDUCATION',
    eventTypeName: 'Education',
    eventTypeColor: null,
    startDate: report.daily[1].date,
    endDate: report.daily[1].date,
    totalSpending: '30',
    transactionCount: 1,
    currency: 'BRL',
  }
  const aggregate = eventAggregate([event], report)
  expect(aggregate.normalAmount).toBe('15.000000')
  expect(aggregate.lift).toBe('15.000000')
  expect(aggregate.totalEventDays).toBe(1)
  event.startDate = report.daily[0].date
  event.endDate = report.daily[2].date
  expect(eventAggregate([event], report).lift).toBeNull()
  event.totalSpending = null
  expect(eventAggregate([event], report).totalSpent).toBeNull()
})
