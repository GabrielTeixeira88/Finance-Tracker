import { IncomeFlowStrip } from './spending-position'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request, getPayees, type Category } from '@/lib/api'
import { useRoute, navigateTo } from '@/lib/navigation'
import { t, ui } from '@/lib/i18n'
import {
  dayAfter,
  previousSpendingPeriod,
  spendingPeriod,
  spendingRanges,
  validDay,
  budgetMonthForPeriod,
} from '@/lib/spending-period'
import { decimalUnits, subtractMoney } from '@/lib/money'
import {
  Money,
  ErrorState,
  LoadingState,
  SectionHeader,
} from '@/components/primitives'
import { CompositionChart } from '@/components/composition-chart'
import { CalendarDays } from 'lucide-react'
import type { ReactNode } from 'react'

export function InsightRange({
  asOf,
  children,
}: {
  asOf: string
  children?: ReactNode
}) {
  const route = useRoute()
  const update = (start: string, end: string) =>
    navigateTo('Budget', undefined, {
      ...Object.fromEntries(route.params),
      view: 'Insights',
      insight_range: 'period',
      month: budgetMonthForPeriod(start, end, asOf),
      start,
      end,
    })
  return (
    <div className="insight-period-controls">
      <nav className="range-tabs" aria-label={t('parity:insight_period')}>
        {spendingRanges.map((range) => (
          <button
            key={range}
            aria-pressed={
              route.params.get('start') === spendingPeriod(range, asOf).start
            }
            onClick={() => {
              const p = spendingPeriod(range, asOf)
              update(p.start, p.end)
            }}
          >
            {ui(
              range === 'MTD'
                ? 'This month'
                : range === 'LAST'
                  ? 'Last month'
                  : range,
            )}
          </button>
        ))}
      </nav>
      <details className="insight-calendar">
        <summary aria-label={t('parity:choose_dates')}>
          <CalendarDays size={15} />
        </summary>
        <div className="insight-calendar-content">
          {children}
          <form
            key={`${route.params.get('start')}-${route.params.get('end')}`}
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              update(String(data.get('start')), String(data.get('end')))
            }}
          >
            <label>
              {t('parity:from')}
              <input
                type="date"
                max={asOf}
                name="start"
                required
                defaultValue={
                  route.params.get('start') || `${asOf.slice(0, 7)}-01`
                }
              />
            </label>
            <label>
              {t('parity:to')}
              <input
                type="date"
                max={asOf}
                name="end"
                required
                defaultValue={route.params.get('end') || asOf}
              />
            </label>
            <button type="submit">{ui('Apply')}</button>
          </form>
        </div>
      </details>
    </div>
  )
}
const schema = z.object({
  expenses: z.string(),
  income: z.string(),
  categories: z.array(
    z.object({ category_id: z.string().nullable(), spent: z.string() }),
  ),
  payees: z.array(
    z.object({ payee_id: z.string().nullable(), spent: z.string() }),
  ),
})
export function PeriodSpendingInsights({
  currency,
  categories,
  onTransactions,
  asOf,
}: {
  currency: string
  asOf: string
  categories: Category[]
  onTransactions: (filters: Record<string, string>) => void
}) {
  const route = useRoute(),
    start = route.params.get('start') || '',
    end = route.params.get('end') || ''
  const valid = validDay(start) && validDay(end) && start <= end && end <= asOf
  const monthToDate = start === `${asOf.slice(0, 7)}-01` && end === asOf
  const previous = valid
    ? previousSpendingPeriod(start, end, monthToDate)
    : { start: '', end: '' }
  const query = useQuery({
    queryKey: ['spending-period-insights', currency, start, end],
    enabled: valid,
    queryFn: async ({ signal }) => {
      const load = (from: string, to: string) =>
        request(
          '/spending/summary?' +
            new URLSearchParams({
              currency,
              date_from: from,
              date_to: dayAfter(to),
            }),
          { signal },
        ).then((v) => schema.parse(v))
      const [current, prior, payees] = await Promise.all([
        load(start, end),
        load(previous.start, previous.end),
        getPayees('', signal),
      ])
      return { current, prior, payees }
    },
  })
  if (!valid) return <ErrorState text={t('parity:valid_period')} />
  if (query.isPending) return <LoadingState />
  if (query.isError)
    return (
      <ErrorState
        text={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  const { current, prior, payees } = query.data
  const changed = route.params.get('stage') === 'changed'
  const ids = [
    ...new Set(
      [...current.categories, ...prior.categories].map((c) => c.category_id),
    ),
  ]
  const rows = ids.map((id) => {
    const amount =
      current.categories.find((c) => c.category_id === id)?.spent || '0'
    const before =
      prior.categories.find((c) => c.category_id === id)?.spent || '0'
    return {
      id,
      name:
        categories.find((c) => c.id === id)?.name || t('parity:uncategorized'),
      amount,
      before,
      change: subtractMoney(amount, before),
    }
  })
  const drill = (filters: Record<string, string>) =>
    onTransactions({
      currency,
      spending_only: 'true',
      date_from: start,
      date_to: end,
      ...filters,
    })
  return (
    <div className="period-spending-insights">
      <div className="spending-insight-summary">
        <div>
          <small>{t('spending:net_expenses_409a07')}</small>
          <Money value={current.expenses} currency={currency} minorUnits />
          <p className="metadata">
            {start} - {end}
          </p>
        </div>
        <div>
          <small>
            {t(
              monthToDate
                ? 'parity:same_elapsed_comparison'
                : 'parity:previous_period',
            )}
          </small>
          <Money value={prior.expenses} currency={currency} minorUnits />
          <p className="metadata">
            {t('parity:period_change')}{' '}
            <Money
              value={subtractMoney(current.expenses, prior.expenses)}
              currency={currency}
              minorUnits
            />
          </p>
          <p className="metadata">
            {previous.start} - {previous.end}
          </p>
        </div>
        <div>
          <small>{t('spending:net_cash_flow_d649f1')}</small>
          <Money
            value={subtractMoney(current.income, current.expenses)}
            currency={currency}
            minorUnits
          />
        </div>
      </div>
      <IncomeFlowStrip
        income={current.income}
        netFlow={subtractMoney(current.income, current.expenses)}
        currency={currency}
      />
      <p className="metadata">{t('parity:monthly_target_context')}</p>
      <div className="spending-insight-columns">
        <section>
          <SectionHeader
            title={
              changed ? t('parity:what_changed') : t('parity:where_it_went')
            }
          />
          {!changed && (
            <CompositionChart
              title={t('spending:category_a3c686')}
              currency={currency}
              items={rows.map((r) => ({ name: r.name, value: r.amount }))}
            />
          )}
          <table>
            <thead>
              <tr>
                <th>{t('spending:category_a3c686')}</th>
                <th className="amount-cell">{t('spending:spent_c0d3c9')}</th>
                {changed && (
                  <th className="amount-cell">{t('parity:period_change')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id ?? 'none'}>
                  <th>
                    <button
                      onClick={() =>
                        drill(
                          r.id
                            ? { category_id: r.id }
                            : { uncategorized: 'true' },
                        )
                      }
                    >
                      {r.name}
                    </button>
                  </th>
                  <td className="amount-cell">
                    <Money value={r.amount} currency={currency} />
                  </td>
                  {changed && (
                    <td className="amount-cell">
                      <Money value={r.change} currency={currency} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <SectionHeader title={t('parity:top_payees')} />
          <ol className="income-source-ranking">
            {[...current.payees]
              .sort((a, b) =>
                decimalUnits(a.spent) > decimalUnits(b.spent) ? -1 : 1,
              )
              .slice(0, 10)
              .map((p) => (
                <li key={p.payee_id ?? 'none'}>
                  <button
                    onClick={() =>
                      drill(
                        p.payee_id
                          ? { payee_id: p.payee_id }
                          : { no_payee: 'true' },
                      )
                    }
                  >
                    {payees.find((r) => r.id === p.payee_id)?.name ||
                      t('parity:no_payee')}
                  </button>
                  <Money value={p.spent} currency={currency} />
                </li>
              ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
