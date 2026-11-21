import { it, expect } from 'vitest'
import { buildHeadline } from './headline'
import { headlineDescriptors } from './headline-descriptors'
import { spendingFixture } from '@/test/fixtures/synthetic/spending-workspace'
const t = (key: string) => key
it('composes the source comparison narrative from exact amounts and keeps percent units', () => {
  const report = spendingFixture()
  const model = buildHeadline({
    ...headlineDescriptors(report),
    currentTotal: report.current.expenses,
    priorTotal: report.previous.expenses,
    priorLabel: 'Previous period.',
    metaLabel: 'September',
    t,
  })
  expect(model.summary).toMatchObject({ delta: '250.123456', pct: '62.530864' })
  expect(model.fragments).toContainEqual({
    type: 'amount',
    value: '250.123456',
    tone: 'up',
  })
  expect(
    model.fragments.some(
      (fragment) =>
        fragment.type === 'mover' &&
        fragment.descriptor.name === 'Synthetic Groceries',
    ),
  ).toBe(true)
})
it('does not manufacture a percentage comparison without prior activity', () => {
  const report = spendingFixture()
  report.previous.count = 0
  report.previous.expenses = '0'
  const model = buildHeadline({
    ...headlineDescriptors(report),
    currentTotal: report.current.expenses,
    priorTotal: '0',
    priorLabel: 'Previous',
    metaLabel: 'Month',
    t,
  })
  expect(model.summary).toBeNull()
  expect(
    model.fragments.some(
      (fragment) =>
        fragment.type === 'text' &&
        fragment.text.endsWith('headlineNoPriorSuffix'),
    ),
  ).toBe(true)
})
it('keeps a genuinely empty comparison distinct from zero-growth performance', () => {
  const report = spendingFixture(true)
  report.previous.count = 0
  report.previous.expenses = '0'
  expect(
    buildHeadline({
      ...headlineDescriptors(report),
      currentTotal: '0',
      priorTotal: '0',
      priorLabel: 'Previous',
      metaLabel: 'Month',
      t,
    }).summary,
  ).toBeNull()
})
