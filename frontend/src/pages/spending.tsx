import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Settings2 } from 'lucide-react'
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
import { decimalUnits, formatMoney } from '@/lib/money'
import { useWrite } from '@/lib/use-write'
import { RecentActivity } from '@/components/financial'
import { getTransactions } from '@/lib/api'
import Refunds from './spending-refunds'
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
  if (demo.isPending) return <LoadingState text="Loading spending workspace…" />
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
  const [month, setMonth] = useState(initialMonth)
  const [currency, setCurrency] = useState(accounts[0]?.currency ?? 'BRL')
  const [tab, setTab] = useState<'Overview' | 'Budgets' | 'Insights'>(
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
      setMonth(value)
      setEditing(null)
      setNotice('')
    }
  }
  return (
    <div className="spending-workspace">
      <PageHeader
        title="Spending & Budgets"
        description="Monthly targets, actual spending, and what changed."
      >
        <div className="spending-month">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Previous month"
            disabled={month === '1900-01'}
            onClick={() => setPeriod(shiftMonth(month, -1))}
          >
            <ChevronLeft size={15} />
          </Button>
          <input
            aria-label="Budget month"
            type="month"
            value={month}
            min="1900-01"
            max="2199-12"
            onChange={(e) => setPeriod(e.target.value)}
          />
          <Button
            size="sm"
            variant="ghost"
            aria-label="Next month"
            disabled={month === '2199-12'}
            onClick={() => setPeriod(shiftMonth(month, 1))}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
        <select
          aria-label="Budget currency"
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value)
            setEditing(null)
          }}
        >
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </PageHeader>
      <div className="spending-toolbar">
        <nav className="range-tabs mb-4" aria-label="Spending views">
          {(['Overview', 'Budgets', 'Insights'] as const).map((view) => (
            <button
              key={view}
              aria-pressed={tab === view}
              onClick={() => setTab(view)}
            >
              {view}
            </button>
          ))}
        </nav>
        <div className="spending-actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing('new')
              setTab('Budgets')
            }}
          >
            <Plus size={14} /> Add target
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setGroupsOpen(!groupsOpen)}
          >
            <Settings2 size={14} /> Groups
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRefundsOpen(!refundsOpen)}
          >
            Refunds
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!data || data.pace.status === 'future'}
            onClick={() => drill()}
          >
            View transactions →
          </Button>
        </div>
      </div>
      {write.isError && <ErrorState text={write.error.message} />}
      {notice && (
        <p role="status" className="metadata">
          {notice}
        </p>
      )}
      {report.isPending ? (
        <LoadingState text="Calculating spending…" />
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
                Showing {currency} only. {data.other_currencies.join(', ')}{' '}
                activity is excluded; no exchange rates are applied.
              </p>
            )}
            {data.pace.status === 'future' && (
              <p className="spending-currency-note">
                Future month: actuals stop at {data.as_of}. Future rollover is
                not yet available.
              </p>
            )}
            {groupsOpen && <GroupEditor data={data} />}
            {refundsOpen && (
              <Refunds accounts={accounts} currency={currency} month={month} />
            )}
            {editing && (
              <TargetEditor
                key={`${month}-${currency}-${editing === 'new' ? 'new' : editing.category_id}`}
                row={editing === 'new' ? undefined : editing}
                data={data}
                categories={categories}
                onClose={() => setEditing(null)}
              />
            )}
            {tab === 'Overview' && (
              <>
                <div className="spending-headline">
                  <div>
                    <span className="eyebrow">Spent · {month}</span>
                    <h2>
                      <Money
                        value={data.summary.expenses}
                        currency={currency}
                      />
                    </h2>
                    <p className="metadata">
                      <Money value={data.summary.change} currency={currency} />{' '}
                      versus previous month
                      {data.summary.change_percent !== null
                        ? ` (${data.summary.change_percent}%)`
                        : ' · no positive comparison baseline'}
                    </p>
                  </div>
                  <div className="spending-kpis">
                    <Metric
                      title="Income"
                      value={data.summary.income}
                      currency={currency}
                    />
                    <Metric
                      title="Monthly target"
                      value={data.summary.target}
                      currency={currency}
                    />
                    <Metric
                      title="Net cash flow"
                      value={data.summary.net_flow}
                      currency={currency}
                    />
                  </div>
                </div>
                <DailyChart
                  data={data}
                  onDay={(day) => drill({ date_from: day, date_to: day })}
                />
                <div className="spending-columns">
                  <section>
                    <SectionHeader
                      title="Where it went"
                      detail="Net expenses, after explicitly linked refunds."
                    />
                    <CategoryList
                      rows={data.categories}
                      currency={currency}
                      onClick={categoryDrill}
                    />
                    <SectionHeader title="Recent spending" />
                    <RecentSpending
                      data={data}
                      accounts={accounts}
                      categories={categories}
                    />
                    <Button variant="ghost" onClick={() => drill()}>
                      Open the month's transaction ledger →
                    </Button>
                  </section>
                  <BudgetPace data={data} onManage={() => setTab('Budgets')} />
                </div>
              </>
            )}
            {tab === 'Budgets' && (
              <div className="spending-columns budget-layout">
                <div>
                  <div className="budget-plan">
                    <span className="eyebrow">Monthly plan</span>
                    <h2>
                      <Money value={data.summary.target} currency={currency} />
                    </h2>
                    <p className="metadata">
                      Carryover{' '}
                      <Money
                        value={data.summary.carryover}
                        currency={currency}
                      />{' '}
                      · Available target{' '}
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
                        ? 'No positive target'
                        : `${data.summary.percent}% used`}{' '}
                      · {data.summary.over_count} categories over target
                    </p>
                  </div>
                  {!data.categories.some((r) => r.active) && (
                    <EmptyState
                      title="No monthly targets yet"
                      detail="Set a category target independently of your bank balance."
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
                              spent ·{' '}
                              {g.percent === null
                                ? 'No positive target'
                                : `${g.percent}% used`}
                            </small>
                          </span>
                          <span className="budget-group-total">
                            <Money value={g.available} currency={currency} />
                            <small className="metadata block">
                              available target
                            </small>
                            <small className="metadata block">
                              Base{' '}
                              <Money value={g.target} currency={currency} /> ·
                              Left{' '}
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
                    <h2>Copy previous month's targets</h2>
                    <p className="metadata">
                      Copy {shiftMonth(month, -1)} → {month}. Copies target
                      amounts and group assignments, never spending or
                      carryover.
                    </p>
                    <label className="check-line">
                      <input
                        type="checkbox"
                        checked={replace}
                        onChange={(e) => setReplace(e.target.checked)}
                      />{' '}
                      Replace existing month overrides
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
                                  'Previous month targets copied. Actual spending was unchanged.',
                                ),
                            },
                          )
                      }}
                    >
                      Copy targets
                    </Button>
                  </section>
                </aside>
              </div>
            )}
            {tab === 'Insights' && (
              <Insights
                data={data}
                onCategory={categoryDrill}
                onPayee={(id) =>
                  drill(id ? { payee_id: id } : { no_payee: 'true' })
                }
                onMonth={setPeriod}
              />
            )}
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
function width(spent: string, total: string) {
  const s = decimalUnits(spent),
    t = decimalUnits(total)
  if (t <= 0n) return s > 0n ? 100 : 0
  const p = (s * 10000n) / t
  return Number(p < 0n ? 0n : p > 10000n ? 10000n : p) / 100
}
function Progress({ spent, available }: { spent: string; available: string }) {
  const over = decimalUnits(spent) > decimalUnits(available)
  return (
    <div
      className={`spending-progress ${over ? 'over' : ''}`}
      role="img"
      aria-label={over ? 'Spending over target' : 'Spending progress'}
    >
      <span style={{ width: `${width(spent, available)}%` }} />
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
      <SectionHeader title="Monthly budget">
        {onManage && (
          <Button size="sm" variant="ghost" onClick={onManage}>
            Manage →
          </Button>
        )}
      </SectionHeader>
      <p className="metadata">
        {data.pace.status === 'closed'
          ? 'Period closed'
          : `Day ${data.pace.elapsed_days} / ${data.pace.days_in_month}`}{' '}
        · {data.pace.elapsed_percent}% elapsed
      </p>
      <h2>
        <Money value={s.remaining} currency={data.currency} />{' '}
        <small>remaining</small>
      </h2>
      <p className="metadata">
        Includes unbudgeted expenses and signed carryover.
      </p>
      <Progress spent={s.expenses} available={s.available} />
      <div className="spending-kpis">
        <Metric
          title="Budgeted spending"
          value={s.budgeted_spending}
          currency={data.currency}
        />
        <Metric
          title="Unbudgeted spending"
          value={s.unbudgeted_spending}
          currency={data.currency}
        />
      </div>
      <div className="spending-projection">
        <span className="metadata">Estimated month-end spending</span>
        {data.pace.projection === null ? (
          <p className="metadata">
            Available for the current month after three elapsed days with
            positive net spending.
          </p>
        ) : (
          <>
            <strong>
              <Money value={data.pace.projection} currency={data.currency} />
            </strong>
            <p className="metadata">
              Spent ÷ elapsed days × days in month. An estimate; bills need not
              arrive evenly.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
function DailyChart({
  data,
  onDay,
}: {
  data: BudgetReport
  onDay: (day: string) => void
}) {
  const units = data.daily.map((d) => decimalUnits(d.amount))
  const high = units.reduce((a, v) => (v > a ? v : a), 0n)
  const low = units.reduce((a, v) => (-v > a ? -v : a), 0n)
  const span = high + low
  const zero = span ? Number((low * 10000n) / span) / 100 : 0
  return (
    <section aria-label="Daily spending chart" className="daily-spending">
      <div className="daily-bars">
        {data.daily.map((d, i) => {
          const units = decimalUnits(d.amount),
            abs = units < 0n ? -units : units
          const height = span ? Number((abs * 10000n) / span) / 100 : 0
          return (
            <button
              disabled={d.date > data.as_of}
              key={d.date}
              title={`${d.date}: ${formatMoney(d.amount, data.currency)}`}
              aria-label={`${d.date}: ${formatMoney(d.amount, data.currency)} — view transactions`}
              onClick={() => onDay(d.date)}
            >
              <span
                className={units < 0n ? 'refund-bar' : ''}
                style={{
                  height: `${height}%`,
                  bottom: `${units < 0n ? zero - height : zero}%`,
                }}
              />
              <small>{i + 1}</small>
            </button>
          )
        })}
      </div>
      <p className="metadata">
        Daily net spending · hover for exact values, select a day for
        transactions. Refunds may make a day negative.
      </p>
    </section>
  )
}
function CategoryList({
  rows,
  currency,
  onClick,
}: {
  rows: BudgetRow[]
  currency: string
  onClick: (r: BudgetRow) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = rows
    .filter((r) => decimalUnits(r.spent) !== 0n)
    .sort((a, b) => (decimalUnits(a.spent) > decimalUnits(b.spent) ? -1 : 1))
  if (!visible.length) return <EmptyState title="No spending in this month" />
  const max = visible[0].spent
  return (
    <div className="spending-category-list">
      {(expanded ? visible : visible.slice(0, 4)).map((r) => (
        <button key={r.category_id ?? 'none'} onClick={() => onClick(r)}>
          <span>
            {r.name}
            <Progress spent={r.spent} available={max} />
          </span>
          <Money value={r.spent} currency={currency} />
        </button>
      ))}
      {visible.length > 4 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? 'Show fewer categories'
            : `Show all ${visible.length} categories`}
        </Button>
      )}
    </div>
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
          Category targets and actual spending
        </caption>
        <thead>
          <tr>
            <th>Category</th>
            <th className="text-right">Target</th>
            <th className="text-right">Spent</th>
            <th className="text-right">Remaining</th>
            <th>Progress</th>
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
                  {r.override ? 'Month override' : 'Monthly default'}
                  {r.rollover_enabled && (
                    <>
                      {' '}
                      · Rollover{' '}
                      <Money value={r.carryover} currency={currency} />
                    </>
                  )}
                </small>
              </th>
              <td className="text-right">
                <Money value={r.target} currency={currency} />
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
                  {r.status}
                  {r.percent !== null ? ` · ${r.percent}%` : ''}
                </small>
              </td>
              <td>
                {r.category_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(r)}
                    aria-label={`Edit target ${r.name}`}
                  >
                    Edit
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
  const [scope, setScope] = useState(row?.override ? 'month' : 'default')
  const [rollover, setRollover] = useState(row?.rollover_enabled ?? false)
  const [active, setActive] = useState(row?.target_id ? row.active : true)
  const [group, setGroup] = useState(row?.group_id ?? '')
  const [order, setOrder] = useState(row?.sort_order ?? 0)
  const [error, setError] = useState('')
  const write = useWrite()
  return (
    <form
      className="editor-surface budget-editor"
      aria-label="Target editor"
      onSubmit={(e) => {
        e.preventDefault()
        if (!openingInput.safeParse(amount).success) {
          setError('Enter zero or a positive exact amount, up to six decimals.')
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
        title={row ? `Edit ${row.name}` : 'New category target'}
        detail={`Applies from ${data.month}. Earlier months keep their target configuration.`}
      />
      {(error || write.isError) && (
        <ErrorState text={error || write.error!.message} />
      )}
      <fieldset disabled={write.isPending} className="filter-bar">
        <Field label="Target category">
          <select
            required
            value={categoryId}
            disabled={!!row}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Choose category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Target amount (${data.currency})`}>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Target applies to">
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="default">This month onward (default)</option>
            <option value="month">This month only (override)</option>
          </select>
        </Field>
        <Field label="Budget group">
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">Ungrouped</option>
            {data.groups
              .filter((g) => g.id)
              .map((g) => (
                <option key={g.id} value={g.id!}>
                  {g.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Category sort order">
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
          Carry unused and overspent amounts forward
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />{' '}
          Target active
        </label>
        <Button type="submit">Save target</Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
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
            Disable target
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
            Restore monthly default
          </Button>
        )}
      </fieldset>
      <p className="metadata">
        A default change runs until the next saved default version. Existing
        month overrides take precedence. Grouping and rollover follow the
        selected scope.
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
      aria-label="Group editor"
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
      <h2>Category groups</h2>
      {write.isError && <ErrorState text={write.error.message} />}
      <fieldset disabled={write.isPending} className="filter-bar">
        <Field label="Edit group">
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value)
              const g = data.groups.find((g) => g.id === e.target.value)
              setName(g?.name ?? '')
              setOrder(g?.sort_order ?? 0)
            }}
          >
            <option value="">New group</option>
            {data.groups
              .filter((g) => g.id)
              .map((g) => (
                <option key={g.id} value={g.id!}>
                  {g.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Group name">
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Group sort order">
          <input
            type="number"
            min="0"
            max="100000"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
        </Field>
        <Button type="submit">Save group</Button>
        {id && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (
                window.confirm(
                  'Delete this unreferenced group? Referenced history is protected.',
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
            Delete group
          </Button>
        )}
      </fieldset>
      <p className="metadata">
        Names and group order are presentation settings. Assign a category
        through its target editor, effective from the selected month.
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
  const movers = data.categories
    .filter((r) => decimalUnits(r.change) !== 0n)
    .sort((a, b) => {
      const x = decimalUnits(a.change),
        y = decimalUnits(b.change)
      return (x < 0n ? -x : x) > (y < 0n ? -y : y) ? -1 : 1
    })
    .slice(0, 8)
  return (
    <>
      <div className="spending-insight-summary">
        <div>
          <Metric
            title="Remaining target"
            value={data.summary.remaining}
            currency={data.currency}
          />
          <p className="metadata">
            {data.summary.over_count} categories over target ·{' '}
            {data.summary.percent === null
              ? 'No positive target'
              : `${data.summary.percent}% used`}
          </p>
          <Progress
            spent={data.summary.expenses}
            available={data.summary.available}
          />
          <p className="metadata">
            Available target{' '}
            <Money value={data.summary.available} currency={data.currency} /> ·
            includes signed carryover.
          </p>
        </div>
        <div>
          <Metric
            title="Spending change from previous month"
            value={data.summary.change}
            currency={data.currency}
          />
          <p className="metadata">
            {data.summary.change_percent === null
              ? 'No positive prior-month baseline for a percentage comparison.'
              : `${data.summary.change_percent}% compared with the full previous month. Current-month comparisons may be partial.`}
          </p>
        </div>
        <div>
          <Metric
            title="Net cash flow"
            value={data.summary.net_flow}
            currency={data.currency}
          />
          <Metric
            title="Uncategorized spending"
            value={data.categories.find((r) => !r.category_id)?.spent ?? '0'}
            currency={data.currency}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onCategory(
                data.categories.find((r) => !r.category_id) ??
                  ({ category_id: null } as BudgetRow),
              )
            }
          >
            Review uncategorized →
          </Button>
        </div>
      </div>
      <div className="spending-columns">
        <section>
          <SectionHeader
            title="What changed"
            detail="Largest category increases and decreases, including refunds."
          />
          {!movers.length ? (
            <EmptyState title="No category spending changes" />
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
                    Previous{' '}
                    <Money value={r.previous} currency={data.currency} /> ·
                    Selected <Money value={r.spent} currency={data.currency} />
                  </small>
                </span>
                <Money value={r.change} currency={data.currency} />
              </button>
            ))
          )}
        </section>
        <section>
          <SectionHeader
            title="Top payees"
            detail="Net spending; select a payee to inspect the ledger."
          />
          {!data.payees.length ? (
            <EmptyState title="No payee spending yet" />
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
      <SectionHeader
        title="Monthly cash flow"
        detail="Actual ledger movements only. Transfers, openings, and unposted schedules are excluded."
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">Income</th>
              <th className="text-right">Net expenses</th>
              <th className="text-right">Net cash flow</th>
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

function RecentSpending({
  data,
  accounts,
  categories,
}: {
  data: BudgetReport
  accounts: Account[]
  categories: Category[]
}) {
  const params = new URLSearchParams({
    currency: data.currency,
    spending_only: 'true',
    date_from: data.date_from,
    date_to: data.date_to < data.as_of ? data.date_to : data.as_of,
    limit: '4',
  })
  const rows = useQuery({
    queryKey: ['transactions', 'spending-recent', params.toString()],
    queryFn: ({ signal }) => getTransactions(params, signal),
    enabled: data.pace.status !== 'future',
  })
  if (data.pace.status === 'future')
    return <EmptyState title="No actual spending in a future month" />
  if (rows.isPending) return <LoadingState text="Loading recent spending..." />
  if (rows.isError) return <ErrorState text={rows.error.message} />
  return (
    <RecentActivity
      rows={rows.data}
      accounts={accounts}
      categories={categories}
    />
  )
}
