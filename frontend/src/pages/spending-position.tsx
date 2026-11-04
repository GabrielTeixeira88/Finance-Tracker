import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { BudgetProgress } from '@/components/budget-progress'
import { Money, SectionHeader, EmptyState } from '@/components/primitives'
import type { BudgetReport, BudgetRow } from '@/lib/budget-api'
import { decimalUnits, sumMoney, formatExactPercent } from '@/lib/money'
import { navigateTo, useRoute } from '@/lib/navigation'
import { t, ui } from '@/lib/i18n'

export function SpendingPosition({
  data,
  onCategory,
  onManage,
}: {
  data: BudgetReport
  onCategory: (row: BudgetRow) => void
  onManage: () => void
}) {
  const route = useRoute()
  const filter = route.params.get('plan_filter') || 'all'
  const sort = route.params.get('plan_sort') || 'spent'
  const update = (value: Record<string, string>) =>
    navigateTo('Budget', undefined, {
      ...Object.fromEntries(route.params),
      view: 'Insights',
      ...value,
    })
  const [collapsed, setCollapsed] = useState<Set<string | null>>(new Set())
  const rows = data.categories.filter(
    (r) => r.target_id || decimalUnits(r.spent) !== 0n,
  )
  const change = (r: BudgetRow) =>
    data.narrative?.comparisons?.find((c) => c.category_id === r.category_id)
      ?.change ?? r.change
  const matches = (r: BudgetRow, key: string) =>
    key === 'over'
      ? r.status === 'Over target'
      : key === 'movers'
        ? decimalUnits(change(r)) !== 0n
        : key === 'none'
          ? decimalUnits(r.available) <= 0n
          : true
  const filtered = rows
    .filter((r) => matches(r, filter))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      const x = decimalUnits(sort === 'change' ? change(a) : a.spent),
        y = decimalUnits(sort === 'change' ? change(b) : b.spent)
      return x > y ? -1 : x < y ? 1 : a.name.localeCompare(b.name)
    })
  const ids = [...new Set(filtered.map((r) => r.group_id))]
  const groups = ids.map((id) => ({
    id,
    name: data.groups.find((g) => g.id === id)?.name ?? t('parity:ungrouped'),
    rows: filtered.filter((r) => r.group_id === id),
  }))
  const summary = data.summary
  const composition = rows
    .filter((r) => decimalUnits(r.spent) > 0n)
    .sort((a, b) => (decimalUnits(a.spent) > decimalUnits(b.spent) ? -1 : 1))
  const positiveComposition =
    rows.every((r) => decimalUnits(r.spent) >= 0n) &&
    decimalUnits(summary.expenses) > 0n
  const knownPrior = data.narrative?.previous_spending !== undefined
  const comparison = knownPrior
    ? (data.narrative?.change_percent ?? null)
    : summary.change_percent
  const flow = [
    ['income', summary.income],
    ['spending', summary.expenses],
    ['net_flow', summary.net_flow],
  ]
  const maximum = flow.reduce((max, [, v]) => {
    const n = decimalUnits(v)
    const abs = n < 0n ? -n : n
    return abs > max ? abs : max
  }, 0n)
  return (
    <div className="spending-position">
      <div className="spending-insight-summary">
        <section
          data-budget-status={data.narrative?.budget_status ?? 'no_budget'}
        >
          <div className="position-status">
            <span>
              {data.narrative
                ? t(`parity:${data.narrative.budget_status}`)
                : t('parity:spending_plan')}
            </span>
            <small>
              {data.pace.elapsed_days} / {data.pace.days_in_month} /{' '}
              {ui(data.pace.status)}
            </small>
          </div>
          <strong className="position-primary">
            <Money
              value={summary.expenses}
              currency={data.currency}
              minorUnits
            />{' '}
            <small>{t('spending:spent_c0d3c9')}</small>
          </strong>
          <p className="metadata">
            {t('spending:available_target_653677')}{' '}
            <Money
              value={summary.available}
              currency={data.currency}
              minorUnits
            />{' '}
            - {t('spending:remaining_cc632b')}{' '}
            <Money
              value={summary.remaining}
              currency={data.currency}
              minorUnits
            />
          </p>
          <BudgetProgress
            spent={summary.expenses}
            available={summary.available}
          />
        </section>
        <section>
          <span className="section-eyebrow">
            {t('spending:net_expenses_409a07')}
          </span>
          <strong className="position-primary">
            <Money
              value={summary.expenses}
              currency={data.currency}
              minorUnits
            />
          </strong>
          {positiveComposition && (
            <div className="position-composition" aria-hidden="true">
              {composition.map((r, i) => (
                <span
                  key={r.category_id ?? 'none'}
                  style={{
                    width: `${Number((decimalUnits(r.spent) * 10000n) / decimalUnits(summary.expenses)) / 100}%`,
                    background: `var(--chart-${(i % 4) + 3})`,
                  }}
                />
              ))}
            </div>
          )}
          <p className="metadata">
            {comparison === null
              ? t('parity:no_comparison')
              : formatExactPercent(comparison, 2)}{' '}
            /{' '}
            {t(
              knownPrior
                ? 'parity:same_elapsed_comparison'
                : 'parity:full_month_comparison',
            )}
          </p>
        </section>
        <section>
          <span className="section-eyebrow">
            {t('spending:net_cash_flow_d649f1')}
          </span>
          <strong className="position-primary">
            <Money
              value={summary.net_flow}
              currency={data.currency}
              minorUnits
              tone={
                decimalUnits(summary.net_flow) < 0n
                  ? 'negative'
                  : decimalUnits(summary.net_flow) > 0n
                    ? 'positive'
                    : 'neutral'
              }
            />
          </strong>
          <div className="position-flow">
            {flow.map(([key, value]) => (
              <div key={key}>
                <small>{t(`parity:${key}`)}</small>
                <span
                  className="flow-indicator"
                  style={{
                    width: `${maximum ? Number(((decimalUnits(value) < 0n ? -decimalUnits(value) : decimalUnits(value)) * 10000n) / maximum) / 100 : 0}%`,
                    ...(key === 'net_flow' && decimalUnits(value) < 0n
                      ? { background: 'var(--negative)' }
                      : {}),
                  }}
                />
                <Money value={value} currency={data.currency} minorUnits />
              </div>
            ))}
          </div>
        </section>
      </div>
      <IncomeFlowStrip
        income={summary.income}
        netFlow={summary.net_flow}
        currency={data.currency}
      />
      <SectionHeader title={t('parity:spending_plan')} detail={data.month}>
        <label className="plan-sort">
          {t('parity:sort_by')}
          <select
            value={sort}
            onChange={(e) => update({ plan_sort: e.target.value })}
          >
            {['spent', 'name', 'change'].map((v) => (
              <option key={v} value={v}>
                {t(`parity:sort_${v}`)}
              </option>
            ))}
          </select>
        </label>
      </SectionHeader>
      <div className="plan-filters">
        {['all', 'over', 'movers', 'none'].map((key) => (
          <button
            key={key}
            aria-pressed={filter === key}
            onClick={() => update({ plan_filter: key })}
          >
            {t(`parity:plan_${key}`)}{' '}
            <small>{rows.filter((r) => matches(r, key)).length}</small>
          </button>
        ))}
        <button className="text-action" onClick={onManage}>
          {t('spending:manage__bfa0df')}
        </button>
      </div>
      {!filtered.length ? (
        <EmptyState title={t('parity:no_matching_categories')} />
      ) : (
        <div className="table-scroll position-plan">
          <table>
            <caption className="sr-only">{t('parity:spending_plan')}</caption>
            <thead>
              <tr>
                <th>{t('spending:category_a3c686')}</th>
                <th className="amount-cell">{t('parity:spent_available')}</th>
                <th>{t('spending:progress_1b9027')}</th>
                <th
                  className="amount-cell"
                  title={t(
                    knownPrior
                      ? 'parity:same_elapsed_comparison'
                      : 'parity:full_month_comparison',
                  )}
                >
                  {t('parity:change_vs_prior')}
                </th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.id ?? 'none'}>
                <tr className="plan-group">
                  <th>
                    <button
                      aria-expanded={!collapsed.has(group.id)}
                      onClick={() =>
                        setCollapsed((old) => {
                          const next = new Set(old)
                          if (next.has(group.id)) next.delete(group.id)
                          else next.add(group.id)
                          return next
                        })
                      }
                    >
                      {collapsed.has(group.id) ? (
                        <ChevronRight size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}{' '}
                      {group.name}
                    </button>
                  </th>
                  <td className="amount-cell">
                    <Money
                      value={sumMoney(group.rows.map((r) => r.spent))}
                      currency={data.currency}
                      minorUnits
                    />{' '}
                    /{' '}
                    <Money
                      value={sumMoney(group.rows.map((r) => r.available))}
                      currency={data.currency}
                      minorUnits
                    />
                  </td>
                  <td colSpan={2} />
                </tr>
                {!collapsed.has(group.id) &&
                  group.rows.map((r) => (
                    <tr key={r.category_id ?? 'none'}>
                      <th>
                        <button
                          disabled={data.pace.status === 'future'}
                          onClick={() => onCategory(r)}
                        >
                          {r.name}
                        </button>
                        {r.rollover_enabled && (
                          <small className="metadata block">
                            {t('parity:rollover')}{' '}
                            <Money
                              value={r.carryover}
                              currency={data.currency}
                            />
                          </small>
                        )}
                      </th>
                      <td className="amount-cell">
                        <Money
                          value={r.spent}
                          currency={data.currency}
                          minorUnits
                        />{' '}
                        /{' '}
                        <Money
                          value={r.available}
                          currency={data.currency}
                          minorUnits
                        />
                      </td>
                      <td>
                        <BudgetProgress
                          spent={r.spent}
                          available={r.available}
                        />
                        <small className="metadata">
                          {r.percent === null
                            ? ui(r.status)
                            : formatExactPercent(r.percent, 2)}
                        </small>
                      </td>
                      <td className="amount-cell">
                        <Money
                          value={change(r)}
                          currency={data.currency}
                          minorUnits
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  )
}

export function IncomeFlowStrip({
  income,
  netFlow,
  currency,
}: {
  income: string
  netFlow: string
  currency: string
}) {
  return (
    <>
      <SectionHeader
        title={t('parity:income_and_flow')}
        detail={t(
          'spending:actual_ledger_movements_only_transfers_openings__c955f7',
        )}
      />
      <div className="income-flow-strip">
        <div>
          <small>{t('parity:money_in')}</small>
          <div>
            <span>{t('spending:income_1c89b1')}</span>
            <Money value={income} currency={currency} minorUnits />
          </div>
        </div>
        <div>
          <small>{t('spending:net_cash_flow_d649f1')}</small>
          <div>
            <span>{t('parity:income_less_spending')}</span>
            <Money value={netFlow} currency={currency} minorUnits />
          </div>
        </div>
      </div>
    </>
  )
}
