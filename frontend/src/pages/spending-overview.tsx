import { CompositionChart } from '@/components/composition-chart'
import type { BudgetReport } from '@/lib/budget-api'
import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import {
  request,
  getTransactions,
  type Account,
  type Category,
} from '@/lib/api'
import { t, ui } from '@/lib/i18n'
import { m } from 'motion/react'
import { useMotionPolicy, useSelectionId } from '@/lib/motion'
import { MotionChoice } from '@/components/selection-indicator'
import { navigateTo, useRoute } from '@/lib/navigation'
import {
  decimalUnits,
  formatMoney,
  subtractMoney,
  unitsToMoney,
} from '@/lib/money'
import {
  budgetMonthForPeriod,
  dayAfter,
  previousSpendingPeriod,
  spendingPeriod,
  spendingRanges,
  validDay,
} from '@/lib/spending-period'
import {
  ErrorState,
  LoadingState,
  Money,
  SectionHeader,
  EmptyState,
} from '@/components/primitives'
import { RecentActivity } from '@/components/financial'

const summary = z.object({
  income: z.string(),
  expenses: z.string(),
  categories: z.array(
    z.object({ category_id: z.string().nullable(), spent: z.string() }),
  ),
  daily: z.array(z.object({ date: z.string(), amount: z.string() })),
})
const rangeLabels = {
  MTD: 'This month',
  LAST: 'Last month',
  '3M': '3M',
  '6M': '6M',
  YTD: 'YTD',
  '1Y': '1Y',
}

export function SpendingOverview({
  asOf,
  currency,
  categories,
  accounts,
  budget,
  budgetReport,
  onTransactions,
}: {
  asOf: string
  currency: string
  categories: Category[]
  accounts: Account[]
  budget: ReactNode
  budgetReport?: BudgetReport
  onTransactions: (filters: Record<string, string>) => void
}) {
  const route = useRoute()
  const reduced = useMotionPolicy()
  const rangeId = useSelectionId()
  const [categoryView, setCategoryView] = useState<'list' | 'map'>('list')
  const [grouped, setGrouped] = useState(false)
  const candidate = {
    start: route.params.get('start') ?? '',
    end: route.params.get('end') ?? '',
  }
  const valid =
    validDay(candidate.start) &&
    validDay(candidate.end) &&
    candidate.start <= candidate.end &&
    candidate.end <= asOf
  const period = valid ? candidate : spendingPeriod('MTD', asOf)
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [custom, setCustom] = useState(false)
  const [start, setStart] = useState(period.start)
  const [end, setEnd] = useState(period.end)
  const mtd = spendingPeriod('MTD', asOf)
  const previous = previousSpendingPeriod(
    period.start,
    period.end,
    period.start === mtd.start && period.end === mtd.end,
  )
  const load = async (from: string, to: string, signal: AbortSignal) =>
    summary.parse(
      await request(
        `/spending/summary?${new URLSearchParams({ currency, date_from: from, date_to: dayAfter(to) })}`,
        { signal },
      ),
    )
  const data = useQuery({
    queryKey: ['spending', currency, period.start, period.end],
    queryFn: ({ signal }) => load(period.start, period.end, signal),
  })
  const comparison = useQuery({
    queryKey: ['spending', currency, previous.start, previous.end],
    queryFn: ({ signal }) => load(previous.start, previous.end, signal),
  })
  const filters = {
    currency,
    spending_only: 'true',
    date_from: period.start,
    date_to: period.end,
  }
  const recent = useQuery({
    queryKey: ['transactions', 'spending-overview', filters],
    queryFn: ({ signal }) =>
      getTransactions(new URLSearchParams({ ...filters, limit: '6' }), signal),
  })
  function select(next: { start: string; end: string }) {
    navigateTo('Budget', undefined, {
      view: 'Overview',
      ...next,
      currency,
      month: budgetMonthForPeriod(next.start, next.end, asOf),
    })
    setStart(next.start)
    setEnd(next.end)
  }
  if (data.isPending)
    return <LoadingState text={t('spending:calculating_spending__06a346')} />
  if (data.isError)
    return (
      <ErrorState text={data.error.message} retry={() => void data.refetch()} />
    )
  const rows = []
  const byDay = new Map(data.data.daily.map((row) => [row.date, row.amount]))
  for (let date = period.start; date <= period.end; date = dayAfter(date))
    rows.push({ date, amount: byDay.get(date) ?? '0' })
  const highest = rows.reduce((max, row) => {
    const v = decimalUnits(row.amount)
    return v > max ? v : max
  }, 0n)
  const lowest = rows.reduce((max, row) => {
    const v = -decimalUnits(row.amount)
    return v > max ? v : max
  }, 0n)
  const span = highest + lowest
  const zero = span ? Number((lowest * 10000n) / span) / 100 : 0
  const totalUnits = rows.reduce(
    (sum, row) => sum + decimalUnits(row.amount),
    0n,
  )
  const average = rows.length
    ? (totalUnits + BigInt(rows.length) / 2n) / BigInt(rows.length)
    : 0n
  const averagePosition =
    span && rows.length
      ? Number(
          ((totalUnits + lowest * BigInt(rows.length)) * 10000n) /
            (span * BigInt(rows.length)),
        ) / 100
      : 0
  const activeIndex = rows.findIndex((row) => row.date === activeDate)
  const activeRow = rows[activeIndex]
  const sorted = [...data.data.categories].sort((a, b) =>
    decimalUnits(a.spent) > decimalUnits(b.spent)
      ? -1
      : decimalUnits(a.spent) < decimalUnits(b.spent)
        ? 1
        : 0,
  )
  return (
    <section className="spending-overview">
      <div className="spending-headline">
        <div>
          <span className="eyebrow">
            {t('spending:spent__6ac65e')} · {period.start} — {period.end}
          </span>
          <h2 className="spending-value">
            <Money value={data.data.expenses} currency={currency} />
          </h2>
          <div className="metadata">
            {comparison.data ? (
              <>
                <Money
                  value={subtractMoney(
                    data.data.expenses,
                    comparison.data.expenses,
                  )}
                  currency={currency}
                />{' '}
                {ui('from prior period')}
              </>
            ) : comparison.isError ? (
              <button onClick={() => void comparison.refetch()}>
                {ui('Retry comparison')}
              </button>
            ) : (
              ui('Loading comparison')
            )}
          </div>
        </div>
        <div className="spending-kpis">
          {[
            ['Income', data.data.income],
            ['Spending', data.data.expenses],
            [
              'Net cash flow',
              subtractMoney(data.data.income, data.data.expenses),
            ],
          ].map(([label, value]) => (
            <div className="spending-metric" key={label}>
              <span className="metadata">{ui(label)}</span>
              <strong>
                <Money value={value} currency={currency} />
              </strong>
            </div>
          ))}
        </div>
      </div>
      <section
        className="spending-hero"
        aria-label={t('spending:daily_spending_chart_4d295e')}
      >
        <div className="daily-bars">
          {average > 0n && (
            <div
              className="spending-average-line"
              aria-hidden="true"
              style={{ bottom: `${averagePosition}%` }}
            />
          )}
          {rows.map((row, index) => {
            const units = decimalUnits(row.amount)
            const height = span
              ? Number(((units < 0n ? -units : units) * 10000n) / span) / 100
              : 0
            return (
              <button
                key={row.date}
                aria-label={`${row.date}: ${formatMoney(row.amount, currency)}`}
                aria-describedby={
                  activeDate === row.date ? 'spending-chart-tooltip' : undefined
                }
                data-active={activeDate === row.date || undefined}
                onMouseEnter={() => setActiveDate(row.date)}
                onMouseLeave={() => setActiveDate(null)}
                onFocus={() => setActiveDate(row.date)}
                onBlur={() => setActiveDate(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setActiveDate(null)
                }}
                onClick={() =>
                  onTransactions({
                    ...filters,
                    date_from: row.date,
                    date_to: row.date,
                  })
                }
              >
                <m.span
                  className={units < 0n ? 'refund-bar' : ''}
                  initial={false}
                  animate={{
                    height: `${height}%`,
                    bottom: `${units < 0n ? zero - height : zero}%`,
                  }}
                  transition={{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }}
                />
                {(rows.length <= 31 ||
                  index % Math.ceil(rows.length / 12) === 0) && (
                  <small>
                    {rows.length <= 31 ? row.date.slice(8) : row.date.slice(5)}
                  </small>
                )}
              </button>
            )
          })}
        </div>
        {activeRow && (
          <div
            id="spending-chart-tooltip"
            role="tooltip"
            className="spending-chart-tooltip"
            style={{
              left: `clamp(100px, ${((activeIndex + 0.5) / rows.length) * 100}%, calc(100% - 100px))`,
            }}
          >
            <span className="metadata">{activeRow.date}</span>
            <strong>{formatMoney(activeRow.amount, currency)}</strong>
            {average > 0n && (
              <small>
                {ui('Daily average (rounded)')} ?{' '}
                {formatMoney(unitsToMoney(average), currency)}
              </small>
            )}
          </div>
        )}
      </section>
      <nav
        className="spending-periods range-tabs"
        aria-label={ui('Spending period')}
      >
        {spendingRanges.map((range) => {
          const value = spendingPeriod(range, asOf)
          return (
            <MotionChoice
              key={range}
              groupId={rangeId}
              selected={
                value.start === period.start && value.end === period.end
              }
              onClick={() => select(value)}
            >
              {ui(rangeLabels[range])}
            </MotionChoice>
          )
        })}
        <button aria-expanded={custom} onClick={() => setCustom(!custom)}>
          {ui('Custom')}
        </button>
      </nav>
      {custom && (
        <form
          className="spending-custom"
          onSubmit={(e) => {
            e.preventDefault()
            if (validDay(start) && validDay(end) && start <= end && end <= asOf)
              select({ start, end })
          }}
        >
          <label>
            {ui('From')}
            <input
              type="date"
              required
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            {ui('To')}
            <input
              type="date"
              required
              value={end}
              min={start}
              max={asOf}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button type="submit">{ui('Apply')}</button>
        </form>
      )}
      <div className="spending-columns">
        <div>
          <SectionHeader title={t('spending:where_it_went_20d27b')}>
            <div className="spending-breakdown-controls">
              <nav
                className="range-tabs"
                aria-label={t('parity:category_display')}
              >
                {(['list', 'map'] as const).map((v) => (
                  <button
                    key={v}
                    aria-pressed={categoryView === v}
                    onClick={() => setCategoryView(v)}
                  >
                    {t(`parity:${v}`)}
                  </button>
                ))}
              </nav>
              {budgetReport && (
                <label>
                  <input
                    type="checkbox"
                    checked={grouped}
                    onChange={(e) => setGrouped(e.target.checked)}
                  />
                  {t('parity:group_categories')}
                </label>
              )}
              <button
                className="text-action"
                onClick={() =>
                  navigateTo('Budget', undefined, {
                    view: 'Insights',
                    month:
                      route.params.get('month') ??
                      budgetMonthForPeriod(period.start, period.end, asOf),
                    ...period,
                    currency,
                  })
                }
              >
                {ui('Insights')} →
              </button>
            </div>
          </SectionHeader>
          {grouped && budgetReport && (
            <p className="metadata">
              {t('parity:grouping_month', { month: budgetReport.month })}
            </p>
          )}
          {categoryView === 'map' ? (
            <CompositionChart
              title={t('spending:category_a3c686')}
              kind="treemap"
              compact
              currency={currency}
              items={sorted.map((row) => ({
                id: row.category_id ?? undefined,
                name:
                  categories.find((c) => c.id === row.category_id)?.name ??
                  ui('Uncategorized'),
                value: row.spent,
              }))}
              onSelect={(row) =>
                onTransactions({
                  ...filters,
                  ...(row.id
                    ? { category_id: row.id }
                    : { uncategorized: 'true' }),
                })
              }
            />
          ) : (
            <div className="spending-category-list">
              {sorted.length > 0 &&
                sorted.every((row) => decimalUnits(row.spent) >= 0n) &&
                decimalUnits(data.data.expenses) > 0n && (
                  <div className="spending-composition" aria-hidden="true">
                    {sorted.map((row, index) => (
                      <span
                        key={row.category_id ?? 'none'}
                        style={{
                          width: `${Number((decimalUnits(row.spent) * 10000n) / decimalUnits(data.data.expenses)) / 100}%`,
                          background: `var(--chart-${(index % 4) + 3})`,
                        }}
                      />
                    ))}
                  </div>
                )}

              {sorted.length ? (
                (grouped
                  ? [...sorted].sort((a, b) => {
                      const groupName = (id: string | null) =>
                        budgetReport?.groups.find(
                          (g) =>
                            g.id ===
                            budgetReport.categories.find(
                              (c) => c.category_id === id,
                            )?.group_id,
                        )?.name ?? ui('Ungrouped')
                      return groupName(a.category_id).localeCompare(
                        groupName(b.category_id),
                      )
                    })
                  : sorted.slice(0, 4)
                ).map((row) => (
                  <button
                    key={row.category_id ?? 'none'}
                    onClick={() =>
                      onTransactions({
                        ...filters,
                        ...(row.category_id
                          ? { category_id: row.category_id }
                          : { uncategorized: 'true' }),
                      })
                    }
                  >
                    <span>
                      {grouped && (
                        <small className="metadata block">
                          {budgetReport?.groups.find(
                            (g) =>
                              g.id ===
                              budgetReport.categories.find(
                                (c) => c.category_id === row.category_id,
                              )?.group_id,
                          )?.name ?? ui('Ungrouped')}
                        </small>
                      )}
                      {categories.find(
                        (category) => category.id === row.category_id,
                      )?.name ?? ui('Uncategorized')}
                    </span>
                    <Money value={row.spent} currency={currency} />
                  </button>
                ))
              ) : (
                <EmptyState title={ui('No spending in this period')} />
              )}
            </div>
          )}
          <SectionHeader title={t('spending:recent_spending_a55575')}>
            <button
              className="text-action"
              onClick={() => onTransactions(filters)}
            >
              {ui('View all')} →
            </button>
          </SectionHeader>
          {recent.isPending ? (
            <LoadingState />
          ) : recent.isError ? (
            <ErrorState
              text={recent.error.message}
              retry={() => void recent.refetch()}
            />
          ) : (
            <RecentActivity
              rows={recent.data}
              accounts={accounts}
              categories={categories}
            />
          )}
          <button
            className="text-action"
            onClick={() =>
              navigateTo('Budget', undefined, {
                view: 'Life Events',
                month: route.params.get('month') ?? asOf.slice(0, 7),
                ...period,
                currency,
              })
            }
          >
            {ui('Life Events')} →
          </button>
        </div>
        <div>{budget}</div>
      </div>
      <details>
        <summary aria-label={ui('Daily spending details')}>
          {ui('Details')}
        </summary>
        <p className="metadata">
          {period.start} — {period.end} · {ui('Comparison')}: {previous.start} —{' '}
          {previous.end} · {currency}
        </p>
        <table>
          <caption>{ui('Daily spending')}</caption>
          <thead>
            <tr>
              <th>{ui('Date')}</th>
              <th>{ui('Amount')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{formatMoney(row.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
