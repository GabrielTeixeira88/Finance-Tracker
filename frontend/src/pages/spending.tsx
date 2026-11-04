import { BudgetProgress as Progress } from '@/components/budget-progress'
import { SpendingPosition } from './spending-position'
import { DetailDrawer } from '@/components/detail-drawer'
import {
  InsightRange,
  PeriodSpendingInsights,
} from './period-spending-insights'
import { t as tr, ui } from '@/lib/i18n'
import { SectionNavigation } from '@/components/section-navigation'
import { BudgetPaceChart } from '@/components/budget-pace-chart'
import { SpendingOverview } from './spending-overview'
import { useSection, useRoute, navigateTo } from '@/lib/navigation'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
} from 'lucide-react'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
  SectionHeader,
} from '@/components/primitives'
import { getDemo, openingInput, type Account, type Category } from '@/lib/api'
import {
  getBudget,
  shiftMonth,
  type BudgetReport,
  type BudgetRow,
} from '@/lib/budget-api'
import { decimalUnits } from '@/lib/money'
import { useWrite } from '@/lib/use-write'
import Refunds from './spending-refunds'
import LifeEvents from './life-events'
import { SpendingStory } from '@/components/spending-story'
import './spending.css'

type Props = {
  accounts: Account[]
  categories: Category[]
  onTransactions: (filters: Record<string, string>) => void
}
const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Spending(props: Props) {
  const demo = useQuery({
    queryKey: ['demo'],
    queryFn: ({ signal }) => getDemo(signal),
  })
  if (demo.isPending)
    return (
      <LoadingState text={tr('spending:loading_spending_workspace__7ffd37')} />
    )
  if (demo.isError)
    return (
      <ErrorState text={demo.error.message} retry={() => void demo.refetch()} />
    )
  return (
    <SpendingWorkspace
      {...props}
      initialMonth={
        demo.data.enabled ? demo.data.end_date.slice(0, 7) : currentMonth()
      }
    />
  )
}

export function SpendingWorkspace({
  accounts,
  categories,
  onTransactions,
  initialMonth,
}: Props & { initialMonth: string }) {
  const route = useRoute()
  const month = route.params
    .get('month')
    ?.match(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/)
    ? route.params.get('month')!
    : initialMonth
  const currency =
    route.params.get('currency') ?? accounts[0]?.currency ?? 'BRL'
  const setContext = (values: Record<string, string>) =>
    navigateTo('Budget', undefined, {
      ...Object.fromEntries(route.params),
      ...values,
    })
  const [tab, setTab] = useSection(
    ['Overview', 'Budgets', 'Insights', 'Life Events'] as const,
    'Overview',
  )
  const [editing, setEditing] = useState<BudgetRow | 'new' | null>(null)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [refundsOpen, setRefundsOpen] = useState(false)
  const [replace, setReplace] = useState(false)
  const [notice, setNotice] = useState('')
  const report = useQuery({
    queryKey: ['budgets', month, currency],
    queryFn: ({ signal }) => getBudget(month, currency, signal),
  })
  const write = useWrite()
  const data = report.data
  const currencies = [
    ...new Set([currency, ...accounts.map((a) => a.currency)]),
  ].sort()
  function drill(extra: Record<string, string> = {}) {
    if (data && data.pace.status !== 'future')
      onTransactions({
        currency,
        spending_only: 'true',
        date_from: data.date_from,
        date_to: data.date_to < data.as_of ? data.date_to : data.as_of,
        ...extra,
      })
  }
  const categoryDrill = (r: BudgetRow) =>
    drill(
      r.category_id
        ? { category_id: r.category_id }
        : { uncategorized: 'true' },
    )
  const setPeriod = (value: string) => {
    if (/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value)) {
      setContext({
        month: value,
        ...(tab === 'Insights'
          ? { start: '', end: '', insight_range: '' }
          : {}),
      })
      setEditing(null)
      setNotice('')
    }
  }
  const monthControl = (
    <div className="spending-month">
      <Button
        size="sm"
        variant="ghost"
        aria-label={tr('spending:previous_month_46a299')}
        disabled={month === '1900-01'}
        onClick={() => setPeriod(shiftMonth(month, -1))}
      >
        <ChevronLeft size={15} />
      </Button>
      <input
        aria-label={tr('spending:budget_month_8d6861')}
        type="month"
        value={month}
        min="1900-01"
        max="2199-12"
        onChange={(e) => setPeriod(e.target.value)}
      />
      <Button
        size="sm"
        variant="ghost"
        aria-label={tr('spending:next_month_8abf7c')}
        disabled={month === '2199-12'}
        onClick={() => setPeriod(shiftMonth(month, 1))}
      >
        <ChevronRight size={15} />
      </Button>
    </div>
  )
  return (
    <div
      className={`spending-workspace ${tab === 'Overview' ? 'spending-dashboard' : tab === 'Budgets' ? '' : 'spending-insights-page'}`}
    >
      <PageHeader
        title={
          tab === 'Insights' || tab === 'Life Events'
            ? tr('parity:spending_insights')
            : tr('spending:spending_budgets_a513e0')
        }
        description={
          tab === 'Insights' || tab === 'Life Events'
            ? undefined
            : tr(
                'spending:monthly_targets_actual_spending_and_what_changed_d0532a',
              )
        }
      >
        {(tab === 'Insights' || tab === 'Life Events') && (
          <Button
            className="insights-back"
            aria-label={ui('Back to Spending')}
            variant="ghost"
            onClick={() => setTab('Overview')}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Button>
        )}
        {tab !== 'Overview' && tab !== 'Insights' && monthControl}
        {tab === 'Insights' && data && (
          <InsightRange asOf={data.as_of}>{monthControl}</InsightRange>
        )}
        <select
          aria-label={tr('spending:budget_currency_672794')}
          value={currency}
          onChange={(e) => {
            setContext({ currency: e.target.value })
            setEditing(null)
          }}
        >
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </PageHeader>
      {tab === 'Budgets' && (
        <div className="spending-toolbar">
          <Button variant="ghost" onClick={() => setTab('Overview')}>
            {ui('Back to Spending')}
          </Button>
          {tab === 'Budgets' && (
            <div className="spending-actions">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing('new')
                  setTab('Budgets')
                }}
              >
                <Plus size={14} /> {tr('spending:add_target_00c6a7')}{' '}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setGroupsOpen(!groupsOpen)}
              >
                <Settings2 size={14} /> {tr('spending:groups_ae9629')}{' '}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRefundsOpen(!refundsOpen)}
              >
                {tr('spending:refunds_be32ad')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!data || data.pace.status === 'future'}
                onClick={() => drill()}
              >
                {tr('spending:view_transactions__b8bb89')}
              </Button>
            </div>
          )}
        </div>
      )}
      {write.isError && <ErrorState text={write.error.message} />}
      {notice && (
        <p role="status" className="metadata">
          {notice}
        </p>
      )}
      {report.isPending ? (
        <LoadingState text={tr('spending:calculating_spending__06a346')} />
      ) : report.isError ? (
        <ErrorState
          text={report.error.message}
          retry={() => void report.refetch()}
        />
      ) : (
        data && (
          <>
            {data.other_currencies.length > 0 && (
              <p className="spending-currency-note">
                {' '}
                {tr('spending:showing_163d81')} {currency}{' '}
                {tr('spending:only__512f7c')} {data.other_currencies.join(', ')}{' '}
                {tr(
                  'spending:activity_is_excluded_no_exchange_rates_are_appli_b2dfaf',
                )}{' '}
              </p>
            )}
            {data.pace.status === 'future' && (
              <p className="spending-currency-note">
                {' '}
                {tr('spending:future_month_actuals_stop_at_25b469')}{' '}
                {data.as_of}{' '}
                {tr(
                  'spending:_future_rollover_is_not_yet_available__8610c1',
                )}{' '}
              </p>
            )}
            {groupsOpen && <GroupEditor data={data} />}
            {refundsOpen && (
              <Refunds accounts={accounts} currency={currency} month={month} />
            )}
            {editing && (
              <DetailDrawer
                title={
                  editing === 'new'
                    ? tr('dynamic:new_category_target_17b3fd')
                    : editing.name
                }
                onClose={() => setEditing(null)}
              >
                <TargetEditor
                  key={`${month}-${currency}-${editing === 'new' ? 'new' : editing.category_id}`}
                  row={editing === 'new' ? undefined : editing}
                  data={data}
                  categories={categories}
                  onClose={() => setEditing(null)}
                />
              </DetailDrawer>
            )}
            {tab === 'Overview' && (
              <SpendingOverview
                budgetReport={data}
                asOf={data.as_of}
                currency={currency}
                accounts={accounts}
                categories={categories}
                onTransactions={onTransactions}
                budget={
                  <div className="budget-widget">
                    {monthControl}
                    <BudgetPace
                      data={data}
                      onManage={() => setTab('Budgets')}
                    />
                  </div>
                }
              />
            )}
            {tab === 'Budgets' && (
              <div className="spending-columns budget-layout">
                <div>
                  <div className="budget-plan">
                    <span className="eyebrow">
                      {tr('spending:monthly_plan_b01264')}
                    </span>
                    <h2>
                      <Money value={data.summary.target} currency={currency} />
                    </h2>
                    <p className="metadata">
                      {' '}
                      {tr('spending:carryover_509c59')}{' '}
                      <Money
                        value={data.summary.carryover}
                        currency={currency}
                      />{' '}
                      {tr('spending:_available_target_0b286e')}{' '}
                      <Money
                        value={data.summary.available}
                        currency={currency}
                      />
                    </p>
                    <Progress
                      spent={data.summary.expenses}
                      available={data.summary.available}
                    />
                    <p className="metadata">
                      {data.summary.percent === null
                        ? tr('dynamic:no_positive_target_d65416')
                        : tr('messages:message_f752d5f7a23b', {
                            value0: data.summary.percent,
                          })}{' '}
                      · {data.summary.over_count}{' '}
                      {tr('spending:categories_over_target_0c5a90')}{' '}
                    </p>
                  </div>
                  {!data.categories.some((r) => r.active) && (
                    <EmptyState
                      title={tr('spending:no_monthly_targets_yet_5858f2')}
                      detail={tr(
                        'spending:set_a_category_target_independently_of_your_bank_20bac8',
                      )}
                    />
                  )}
                  {data.groups.map((g) => {
                    const children = data.categories.filter(
                      (r) =>
                        r.group_id === g.id &&
                        (r.active ||
                          r.target_id ||
                          decimalUnits(r.spent) !== 0n),
                    )
                    if (!children.length) return null
                    return (
                      <details
                        className="budget-group"
                        key={g.id ?? 'ungrouped'}
                        open
                      >
                        <summary>
                          <span>
                            {g.name}
                            <small className="metadata block">
                              <Money value={g.spent} currency={currency} />{' '}
                              {tr('spending:spent__8f60a7')}{' '}
                              {g.percent === null
                                ? tr('dynamic:no_positive_target_d65416')
                                : tr('messages:message_f752d5f7a23b', {
                                    value0: g.percent,
                                  })}
                            </small>
                          </span>
                          <span className="budget-group-total">
                            <Money value={g.available} currency={currency} />
                            <small className="metadata block">
                              {tr('spending:available_target_54b6b6')}
                            </small>
                            <small className="metadata block">
                              {' '}
                              {tr('spending:base_077fe9')}{' '}
                              <Money value={g.target} currency={currency} />{' '}
                              {tr('spending:_left_5260a7')}{' '}
                              <Money value={g.remaining} currency={currency} />
                            </small>
                          </span>
                        </summary>
                        <BudgetTable
                          rows={children}
                          currency={currency}
                          onEdit={setEditing}
                          onDrill={categoryDrill}
                          disabledDrill={data.pace.status === 'future'}
                        />
                      </details>
                    )
                  })}
                </div>
                <aside>
                  <BudgetPace data={data} />
                  <section className="budget-copy">
                    <h2>
                      {tr('spending:copy_previous_month_s_targets_67ed9a')}
                    </h2>
                    <p className="metadata">
                      {' '}
                      {tr('spending:copy_af74f7')} {shiftMonth(month, -1)} →{' '}
                      {month}{' '}
                      {tr(
                        'spending:_copies_target_amounts_and_group_assignments_nev_1a25ca',
                      )}{' '}
                    </p>
                    <label className="check-line">
                      <input
                        type="checkbox"
                        checked={replace}
                        onChange={(e) => setReplace(e.target.checked)}
                      />{' '}
                      {tr(
                        'spending:replace_existing_month_overrides_9181a2',
                      )}{' '}
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={write.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Copy ${shiftMonth(month, -1)} targets to ${month}${replace ? ' and replace existing overrides' : ''}?`,
                          )
                        )
                          write.mutate(
                            {
                              path: '/budgets/copy-month',
                              data: {
                                month,
                                currency,
                                replace_existing: replace,
                              },
                            },
                            {
                              onSuccess: () =>
                                setNotice(
                                  tr(
                                    'dynamic:previous_month_targets_copied_actual_spending_wa_8e2a7f',
                                  ),
                                ),
                            },
                          )
                      }}
                    >
                      {tr('spending:copy_targets_165a26')}
                    </Button>
                  </section>
                </aside>
              </div>
            )}
            {(tab === 'Insights' || tab === 'Life Events') && (
              <SectionNavigation
                label={tr('parity:spending_narrative')}
                items={
                  [
                    ['where', tr('parity:where_i_am')],
                    ['changed', tr('spending:what_changed_7e4b91')],
                    ['when', tr('parity:when_where')],
                  ] as const
                }
                value={
                  tab === 'Life Events'
                    ? 'when'
                    : route.params.get('stage') === 'changed'
                      ? 'changed'
                      : 'where'
                }
                onChange={(stage) =>
                  setContext({
                    view: stage === 'when' ? 'Life Events' : 'Insights',
                    stage,
                  })
                }
              />
            )}
            {tab === 'Life Events' && <LifeEvents context={data} />}
            {tab === 'Insights' &&
              ((route.params.get('insight_range') === 'period' ||
                (route.params.get('start') &&
                  route.params.get('start')?.slice(0, 7) !== data.month)) &&
              !(
                route.params.get('start') === data.date_from &&
                route.params.get('end') ===
                  (data.date_to < data.as_of ? data.date_to : data.as_of)
              ) ? (
                <PeriodSpendingInsights
                  asOf={data.as_of}
                  currency={currency}
                  categories={categories}
                  onTransactions={onTransactions}
                />
              ) : (
                <Insights
                  data={data}
                  onCategory={categoryDrill}
                  onPayee={(id) =>
                    drill(id ? { payee_id: id } : { no_payee: 'true' })
                  }
                  onMonth={setPeriod}
                />
              ))}
          </>
        )
      )}
    </div>
  )
}

function Metric({
  title,
  value,
  currency,
}: {
  title: string
  value: string
  currency: string
}) {
  return (
    <div className="spending-metric">
      <span className="metadata">{title}</span>
      <strong>
        <Money value={value} currency={currency} />
      </strong>
    </div>
  )
}
function BudgetPace({
  data,
  onManage,
}: {
  data: BudgetReport
  onManage?: () => void
}) {
  const s = data.summary
  return (
    <section className="budget-pace">
      <SectionHeader title={tr('spending:monthly_budget_f260dd')}>
        {onManage && (
          <Button size="sm" variant="ghost" onClick={onManage}>
            {tr('spending:manage__bfa0df')}
          </Button>
        )}
      </SectionHeader>
      <div className="budget-pace-body">
        <p className="metadata">
          {data.pace.status === 'closed'
            ? tr('dynamic:period_closed_919fb4')
            : tr('messages:message_3907582aaf8a', {
                value0: data.pace.elapsed_days,
                value1: data.pace.days_in_month,
              })}{' '}
          · {data.pace.elapsed_percent} {tr('spending:_elapsed_adf526')}{' '}
        </p>
        <h2>
          <Money value={s.remaining} currency={data.currency} />{' '}
          <small>{tr('spending:remaining_398658')}</small>
        </h2>
        <p className="metadata">
          {ui('Available this month')}:{' '}
          <Money value={s.available} currency={data.currency} />
        </p>
        <BudgetPaceChart data={data} />
        <div className="spending-kpis budget-pace-metrics">
          <Metric
            title={ui('Spent so far')}
            value={s.expenses}
            currency={data.currency}
          />
          <div className="spending-metric">
            <span className="metadata">{ui('Forecast')}</span>
            <strong>
              {data.pace.projection === null ? (
                ui('Unavailable')
              ) : (
                <Money value={data.pace.projection} currency={data.currency} />
              )}
            </strong>
          </div>
        </div>
        <details className="budget-method">
          <summary>{ui('Details')}</summary>
          <p className="metadata">
            {tr(
              'spending:includes_unbudgeted_expenses_and_signed_carryove_764dc7',
            )}
          </p>
          <Metric
            title={tr('spending:budgeted_spending_6bb55c')}
            value={s.budgeted_spending}
            currency={data.currency}
          />
          <Metric
            title={tr('spending:unbudgeted_spending_c6ceed')}
            value={s.unbudgeted_spending}
            currency={data.currency}
          />
          <p className="metadata">
            {data.pace.projection === null
              ? tr(
                  'spending:available_for_the_current_month_after_three_elap_b9d8f3',
                )
              : tr(
                  'spending:spent_elapsed_days_days_in_month_an_estimate_bil_0468cc',
                )}
          </p>
        </details>
      </div>
    </section>
  )
}
function BudgetTable({
  rows,
  currency,
  onEdit,
  onDrill,
  disabledDrill = false,
}: {
  rows: BudgetRow[]
  currency: string
  onEdit: (r: BudgetRow) => void
  onDrill: (r: BudgetRow) => void
  disabledDrill?: boolean
}) {
  return (
    <div className="table-scroll">
      <table className="budget-table">
        <caption className="sr-only">
          {tr('spending:category_targets_and_actual_spending_886a3e')}
        </caption>
        <thead>
          <tr>
            <th>{tr('spending:category_a3c686')}</th>
            <th className="text-right">{tr('spending:target_61ad50')}</th>
            <th className="text-right">{tr('parity:rollover')}</th>
            <th className="text-right">
              {tr('spending:available_target_653677')}
            </th>
            <th className="text-right">{tr('spending:spent_c0d3c9')}</th>
            <th className="text-right">{tr('spending:remaining_cc632b')}</th>
            <th>{tr('spending:progress_1b9027')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category_id ?? 'none'}>
              <th scope="row">
                <button
                  className="text-link"
                  disabled={disabledDrill}
                  onClick={() => onDrill(r)}
                >
                  {r.name}
                </button>
                <small className="metadata block">
                  {r.override
                    ? tr('dynamic:month_override_120f44')
                    : tr('dynamic:monthly_default_f8c020')}
                  {r.rollover_enabled && (
                    <>
                      {tr('spending:_rollover_a18760')}{' '}
                      <Money value={r.carryover} currency={currency} />
                    </>
                  )}
                </small>
              </th>
              <td className="text-right">
                <Money value={r.target} currency={currency} />
              </td>
              <td className="text-right">
                <Money value={r.carryover} currency={currency} />
              </td>
              <td className="text-right">
                <Money value={r.available} currency={currency} />
              </td>
              <td className="text-right">
                <Money value={r.spent} currency={currency} />
              </td>
              <td className="text-right">
                <Money
                  value={r.remaining}
                  currency={currency}
                  tone={r.status === 'Over target' ? 'negative' : 'neutral'}
                />
              </td>
              <td>
                <Progress spent={r.spent} available={r.available} />
                <small className="metadata">
                  {ui(r.status)}
                  {r.percent !== null ? ` · ${r.percent}%` : ''}
                </small>
              </td>
              <td>
                {r.category_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(r)}
                    aria-label={tr('messages:message_204ad7780489', {
                      value0: r.name,
                    })}
                  >
                    {tr('spending:edit_530164')}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TargetEditor({
  row,
  data,
  categories,
  onClose,
}: {
  row?: BudgetRow
  data: BudgetReport
  categories: Category[]
  onClose: () => void
}) {
  const [categoryId, setCategory] = useState(
    row?.category_id ?? categories[0]?.id ?? '',
  )
  const [amount, setAmount] = useState(row?.target ?? '')
  const route = useRoute()
  const [scope, setScope] = useState(
    !row && route.params.get('setup') === 'true' ? 'default' : 'month',
  )
  const [rollover, setRollover] = useState(row?.rollover_enabled ?? false)
  const [active, setActive] = useState(row?.target_id ? row.active : true)
  const [group, setGroup] = useState(row?.group_id ?? '')
  const [order, setOrder] = useState(row?.sort_order ?? 0)
  const [error, setError] = useState('')
  const write = useWrite()
  return (
    <form
      className="editor-surface budget-editor"
      aria-label={tr('spending:target_editor_bb7533')}
      onSubmit={(e) => {
        e.preventDefault()
        if (!openingInput.safeParse(amount).success) {
          setError(
            tr(
              'dynamic:enter_zero_or_a_positive_exact_amount_up_to_six__fbd94e',
            ),
          )
          return
        }
        setError('')
        write.mutate(
          {
            path: '/budgets/targets',
            data: {
              category_id: categoryId,
              currency: data.currency,
              month: data.month,
              scope,
              amount,
              active,
              rollover_enabled: rollover,
              group_id: group || null,
              sort_order: order,
            },
          },
          { onSuccess: onClose },
        )
      }}
    >
      <SectionHeader
        title={
          row
            ? tr('messages:message_f8d9f06aa37b', { value0: row.name })
            : tr('dynamic:new_category_target_17b3fd')
        }
        detail={tr('messages:message_c774169a2e95', { value0: data.month })}
      />
      {(error || write.isError) && (
        <ErrorState text={error || write.error!.message} />
      )}
      <fieldset disabled={write.isPending} className="filter-bar">
        <Field label={tr('spending:target_category_779727')}>
          <select
            required
            value={categoryId}
            disabled={!!row}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{tr('spending:choose_category_a23eff')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={tr('messages:message_4fc0d46e4b71', { value0: data.currency })}
        >
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={tr('spending:target_applies_to_4c7124')}>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="default">
              {tr('spending:this_month_onward_default__5015ab')}
            </option>
            <option value="month">
              {tr('spending:this_month_only_override__6f2364')}
            </option>
          </select>
        </Field>
        <Field label={tr('spending:budget_group_2fabb9')}>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">{tr('spending:ungrouped_a7746f')}</option>
            {data.groups
              .filter((g) => g.id)
              .map((g) => (
                <option key={g.id} value={g.id!}>
                  {g.name}
                </option>
              ))}
          </select>
        </Field>
        <details className="advanced-fields" open={!!row?.rollover_enabled}>
          <summary>{tr('spending:advanced_target_settings_d8a30d')}</summary>
          <p className="metadata">
            {tr(
              'spending:rollover_carries_both_unused_and_overspent_amoun_ef2543',
            )}
          </p>
          <Field label={tr('spending:category_sort_order_d9a41b')}>
            <input
              type="number"
              min="0"
              max="100000"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </Field>
          <label className="check-line">
            <input
              type="checkbox"
              checked={rollover}
              onChange={(e) => setRollover(e.target.checked)}
            />{' '}
            {tr(
              'spending:carry_unused_and_overspent_amounts_forward_a1122d',
            )}{' '}
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />{' '}
            {tr('spending:target_active_eb0cf9')}{' '}
          </label>
        </details>
        <Button type="submit">{tr('spending:save_target_fa5df1')}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {tr('spending:cancel_77dfd2')}
        </Button>
        {row?.target_id && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (
                window.confirm(
                  `Disable ${row.name} from ${data.month}? Prior months stay intact.`,
                )
              )
                write.mutate(
                  {
                    path: `/budgets/targets/${row.target_id}?month=${data.month}`,
                    method: 'DELETE',
                  },
                  { onSuccess: onClose },
                )
            }}
          >
            {tr('spending:disable_target_00e44b')}
          </Button>
        )}
        {row?.override && (
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              write.mutate(
                {
                  path: `/budgets/targets/${row.target_id}/override?month=${data.month}`,
                  method: 'DELETE',
                },
                { onSuccess: onClose },
              )
            }
          >
            {tr('spending:restore_monthly_default_8756e9')}
          </Button>
        )}
      </fieldset>
      <p className="metadata">
        {tr('spending:a_default_change_runs_until_the_next_saved_defau_90de50')}
      </p>
    </form>
  )
}
function GroupEditor({ data }: { data: BudgetReport }) {
  const [id, setId] = useState(''),
    [name, setName] = useState(''),
    [order, setOrder] = useState(0)
  const write = useWrite()
  return (
    <form
      className="editor-surface"
      aria-label={tr('spending:group_editor_44607a')}
      onSubmit={(e) => {
        e.preventDefault()
        write.mutate(
          {
            path: `/budgets/groups${id ? `/${id}` : ''}`,
            method: id ? 'PUT' : 'POST',
            data: { name, sort_order: order },
          },
          {
            onSuccess: () => {
              setId('')
              setName('')
              setOrder(0)
            },
          },
        )
      }}
    >
      <h2>{tr('spending:category_groups_03c493')}</h2>
      {write.isError && <ErrorState text={write.error.message} />}
      <fieldset disabled={write.isPending} className="filter-bar">
        <Field label={tr('spending:edit_group_edb57d')}>
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value)
              const g = data.groups.find((g) => g.id === e.target.value)
              setName(g?.name ?? '')
              setOrder(g?.sort_order ?? 0)
            }}
          >
            <option value="">{tr('spending:new_group_f9850c')}</option>
            {data.groups
              .filter((g) => g.id)
              .map((g) => (
                <option key={g.id} value={g.id!}>
                  {g.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={tr('spending:group_name_ebb7e1')}>
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={tr('spending:group_sort_order_42d5e2')}>
          <input
            type="number"
            min="0"
            max="100000"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
        </Field>
        <Button type="submit">{tr('spending:save_group_36ca68')}</Button>
        {id && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (
                window.confirm(
                  tr(
                    'dynamic:delete_this_unreferenced_group_referenced_histor_0372c8',
                  ),
                )
              )
                write.mutate(
                  { path: `/budgets/groups/${id}`, method: 'DELETE' },
                  {
                    onSuccess: () => {
                      setId('')
                      setName('')
                    },
                  },
                )
            }}
          >
            {tr('spending:delete_group_b6f15b')}
          </Button>
        )}
      </fieldset>
      <p className="metadata">
        {tr('spending:names_and_group_order_are_presentation_settings__79a5e6')}
      </p>
    </form>
  )
}
function Insights({
  data,
  onCategory,
  onPayee,
  onMonth,
}: {
  data: BudgetReport
  onCategory: (r: BudgetRow) => void
  onPayee: (id: string | null) => void
  onMonth: (month: string) => void
}) {
  const route = useRoute()
  const changed = route.params.get('stage') === 'changed'
  const movers = data.categories
    .map((row) => {
      const comparison = data.narrative?.comparisons?.find(
        (item) => item.category_id === row.category_id,
      )
      return comparison
        ? { ...row, previous: comparison.previous, change: comparison.change }
        : row
    })
    .filter((r) => decimalUnits(r.change) !== 0n)
    .sort((a, b) => {
      const x = decimalUnits(a.change),
        y = decimalUnits(b.change)
      return (x < 0n ? -x : x) > (y < 0n ? -y : y) ? -1 : 1
    })
    .slice(0, 8)
  return (
    <>
      {changed && <SpendingStory data={data} onCategory={onCategory} />}
      {!changed && (
        <>
          <SpendingPosition
            data={data}
            onCategory={onCategory}
            onManage={() =>
              navigateTo('Budget', undefined, {
                ...Object.fromEntries(route.params),
                view: 'Budgets',
              })
            }
          />
        </>
      )}
      {changed && (
        <div className="spending-columns">
          <section>
            <SectionHeader
              title={tr('spending:what_changed_7e4b91')}
              detail={tr(
                'spending:largest_category_increases_and_decreases_includi_7d0388',
              )}
            />
            {!movers.length ? (
              <EmptyState
                title={tr('spending:no_category_spending_changes_e9d1af')}
              />
            ) : (
              movers.map((r) => (
                <button
                  className="insight-row"
                  key={r.category_id ?? 'none'}
                  onClick={() => onCategory(r)}
                >
                  <span>
                    {r.name}
                    <small className="metadata block">
                      {' '}
                      {tr('spending:previous_50f942')}{' '}
                      <Money value={r.previous} currency={data.currency} />{' '}
                      {tr('spending:_selected_dc9943')}{' '}
                      <Money value={r.spent} currency={data.currency} />
                    </small>
                  </span>
                  <Money value={r.change} currency={data.currency} />
                </button>
              ))
            )}
          </section>
          <section>
            <SectionHeader
              title={tr('spending:top_payees_965a4a')}
              detail={tr(
                'spending:net_spending_select_a_payee_to_inspect_the_ledge_919b6d',
              )}
            />
            {!data.payees.length ? (
              <EmptyState title={tr('spending:no_payee_spending_yet_1564ab')} />
            ) : (
              data.payees.map((p) => (
                <button
                  className="insight-row"
                  key={p.id ?? 'none'}
                  onClick={() => onPayee(p.id)}
                >
                  <span>{p.name}</span>
                  <Money value={p.spent} currency={data.currency} />
                </button>
              ))
            )}
          </section>
        </div>
      )}
      <SectionHeader
        title={tr('spending:monthly_cash_flow_c4b18e')}
        detail={tr(
          'spending:actual_ledger_movements_only_transfers_openings__c955f7',
        )}
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{tr('spending:month_082bc3')}</th>
              <th className="text-right">{tr('spending:income_1c89b1')}</th>
              <th className="text-right">
                {tr('spending:net_expenses_409a07')}
              </th>
              <th className="text-right">
                {tr('spending:net_cash_flow_d649f1')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.trend.map((t) => (
              <tr key={t.month}>
                <th scope="row">
                  <button
                    className="text-link"
                    onClick={() => onMonth(t.month)}
                  >
                    {t.month}
                  </button>
                </th>
                <td className="text-right">
                  <Money value={t.income} currency={data.currency} />
                </td>
                <td className="text-right">
                  <Money value={t.expenses} currency={data.currency} />
                </td>
                <td className="text-right">
                  <Money value={t.net_flow} currency={data.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
