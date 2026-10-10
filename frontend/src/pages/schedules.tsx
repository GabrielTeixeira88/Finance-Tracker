import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import { PayeePicker } from '@/components/payee-picker'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
} from '@/components/primitives'
import {
  getDemo,
  getPayees,
  label,
  localDate,
  moneyInput,
  openingInput,
  type Account,
  type Category,
} from '@/lib/api'
import {
  frequencies,
  getSchedules,
  getUpcoming,
  getCandidates,
  occurrencePath,
  type Schedule,
  type Occurrence,
} from '@/lib/automation-api'
import { useWrite } from '@/lib/use-write'

function shift(day: string, days: number) {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export default function Schedules(props: {
  accounts: Account[]
  categories: Category[]
}) {
  const demo = useQuery({
    queryKey: ['demo'],
    queryFn: ({ signal }) => getDemo(signal),
  })
  if (demo.isPending) return <LoadingState text="Loading schedules…" />
  if (demo.isError)
    return (
      <ErrorState
        text="Unable to load schedule context"
        retry={() => void demo.refetch()}
      />
    )
  return (
    <ScheduleWorkspace
      {...props}
      asOf={demo.data.enabled ? demo.data.end_date : localDate()}
      demo={demo.data.enabled}
    />
  )
}
function ScheduleWorkspace({
  accounts,
  categories,
  asOf,
  demo,
}: {
  accounts: Account[]
  categories: Category[]
  asOf: string
  demo: boolean
}) {
  const [start, setStart] = useState(shift(asOf, -30))
  const [end, setEnd] = useState(shift(asOf, 29))
  const [editing, setEditing] = useState<Schedule>()
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Occurrence>()
  const write = useWrite()
  const schedules = useQuery({ queryKey: ['schedules'], queryFn: getSchedules })
  const upcoming = useQuery({
    queryKey: ['scheduled', start, end, asOf],
    queryFn: () => getUpcoming(start, end, asOf),
    enabled: !!start && !!end && start <= end,
  })
  const projected = useQuery({
    queryKey: ['scheduled', asOf, shift(asOf, 29), asOf],
    queryFn: () => getUpcoming(asOf, shift(asOf, 29), asOf),
  })
  const payees = useQuery({
    queryKey: ['payees', ''],
    queryFn: () => getPayees(''),
  })
  return (
    <>
      <PageHeader
        title="Scheduled transactions"
        description="Expected events, separate from your actual ledger."
      >
        <Button
          onClick={() => {
            setEditing(undefined)
            setCreating(!creating)
          }}
        >
          {creating ? 'Close schedule form' : 'Create schedule'}
        </Button>
      </PageHeader>
      {demo && (
        <p className="metadata">
          Synthetic demo calendar: {asOf}. No events are posted automatically.
        </p>
      )}
      <section className="panel">
        <h2>Next 30 days · Expected cash flow</h2>
        <p className="metadata">
          Uncompleted occurrences only. Approximate amounts are estimates, not
          balances.
        </p>
        {projected.isPending ? (
          <LoadingState text="Loading projections…" />
        ) : projected.isError ? (
          <ErrorState
            text="Unable to load projections"
            retry={() => void projected.refetch()}
          />
        ) : !projected.data.totals.length ? (
          <EmptyState title="No expected cash flow in this period" />
        ) : (
          projected.data.totals.map((t) => (
            <div className="filter-bar" key={t.currency}>
              <span>
                Expected income <Money value={t.income} currency={t.currency} />
              </span>
              <span>
                Expected expenses{' '}
                <Money value={t.expenses} currency={t.currency} />
              </span>
              <span>
                Expected net <Money value={t.net} currency={t.currency} />
              </span>
            </div>
          ))
        )}
      </section>
      {(creating || editing) && (
        <ScheduleEditor
          key={editing?.id ?? 'new'}
          schedule={editing}
          accounts={accounts}
          categories={categories}
          asOf={asOf}
          payeeName={payees.data?.find((p) => p.id === editing?.payee_id)?.name}
          onSaved={() => {
            setEditing(undefined)
            setCreating(false)
          }}
        />
      )}
      {write.isError && <ErrorState text={write.error.message} />}
      <section className="panel">
        <h2>Schedules</h2>
        {schedules.isPending ? (
          <LoadingState text="Loading schedules…" />
        ) : schedules.isError ? (
          <ErrorState
            text="Unable to load schedules"
            retry={() => void schedules.refetch()}
          />
        ) : (
          <>
            {!schedules.data.length && (
              <EmptyState
                title="No schedules yet"
                detail="Add an expected salary, bill, or one-time event."
              />
            )}
            {schedules.data.map((s) => (
              <div className="automation-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <p className="metadata">
                    {label(s.frequency)} · {s.enabled ? 'Enabled' : 'Disabled'}{' '}
                    · Next outstanding: {s.next_due_date ?? 'None'} ·{' '}
                    {accounts.find((a) => a.id === s.account_id)?.name}
                  </p>
                  <p>
                    {payees.data?.find((p) => p.id === s.payee_id)?.name ??
                      s.description}{' '}
                    ·{' '}
                    {categories.find((c) => c.id === s.category_id)?.name ??
                      'Uncategorized'}
                  </p>
                  <Money value={s.amount} currency={s.currency} />
                  {s.amount_is_approximate && (
                    <span className="metadata"> approximate</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Edit ${s.name}`}
                    onClick={() => {
                      setCreating(false)
                      setEditing(s)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={write.isPending}
                    onClick={() =>
                      write.mutate({
                        path: `/schedules/${s.id}`,
                        method: 'PATCH',
                        data: { enabled: !s.enabled },
                      })
                    }
                  >
                    {s.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={write.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete schedule ${s.name}? Actual transactions will not be deleted.`,
                        )
                      )
                        write.mutate({
                          path: `/schedules/${s.id}`,
                          method: 'DELETE',
                        })
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </section>
      <section className="panel">
        <h2>Expected occurrences</h2>
        <div className="filter-bar">
          <Field label="Schedule range from">
            <input
              type="date"
              required
              value={start}
              onChange={(e) => {
                setStart(e.target.value)
                setSelected(undefined)
              }}
            />
          </Field>
          <Field label="Schedule range to">
            <input
              type="date"
              required
              value={end}
              onChange={(e) => {
                setEnd(e.target.value)
                setSelected(undefined)
              }}
            />
          </Field>
        </div>
        {!start || !end || start > end ? (
          <ErrorState text="Choose a valid date range" />
        ) : upcoming.isPending ? (
          <LoadingState text="Calculating expected occurrences…" />
        ) : upcoming.isError ? (
          <ErrorState
            text={upcoming.error.message}
            retry={() => void upcoming.refetch()}
          />
        ) : (
          <>
            {!upcoming.data.occurrences.length && (
              <EmptyState title="No active occurrences in this range" />
            )}
            <div
              className="table-scroll"
              role="region"
              aria-label="Scheduled occurrences"
              tabIndex={0}
            >
              <table aria-label="Scheduled occurrences">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event / Account</th>
                    <th>Status</th>
                    <th className="amount-cell">Expected amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.data.occurrences.map((o) => (
                    <tr key={`${o.schedule_id}/${o.due_date}`}>
                      <td>{o.due_date}</td>
                      <th scope="row">
                        {o.name}
                        <small className="metadata block">
                          {accounts.find((a) => a.id === o.account_id)?.name} ·{' '}
                          {label(o.frequency)} ·{' '}
                          {categories.find((c) => c.id === o.category_id)
                            ?.name ?? 'Uncategorized'}
                        </small>
                      </th>
                      <td>{label(o.status)}</td>
                      <td className="amount-cell">
                        <Money value={o.amount} currency={o.currency} />
                        {o.amount_is_approximate && (
                          <small className="metadata block">Estimate</small>
                        )}
                      </td>
                      <td>
                        {o.status === 'COMPLETED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={write.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Unlink this completion? The real ledger transaction will remain unchanged.',
                                )
                              )
                                write.mutate({
                                  path: `${occurrencePath(o)}/match`,
                                  method: 'DELETE',
                                })
                            }}
                          >
                            Unlink completion
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelected(o)}
                          >
                            Inspect occurrence
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      {selected && (
        <OccurrenceEditor
          key={`${selected.schedule_id}/${selected.due_date}`}
          row={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  )
}

function ScheduleEditor({
  schedule,
  accounts,
  categories,
  asOf,
  payeeName,
  onSaved,
}: {
  schedule?: Schedule
  accounts: Account[]
  categories: Category[]
  asOf: string
  payeeName?: string
  onSaved: () => void
}) {
  const write = useWrite()
  const [approx, setApprox] = useState(schedule?.amount_is_approximate ?? false)
  const [error, setError] = useState('')
  return (
    <section className="editor-surface">
      <h2>{schedule ? 'Edit schedule' : 'New schedule'}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setError('')
          const form = new FormData(event.currentTarget)
          const value = (key: string) => String(form.get(key) ?? '').trim()
          try {
            const account = accounts.find((a) => a.id === value('account_id'))
            if (!account) throw new Error('Choose an account.')
            const data = {
              name: value('name'),
              description: value('description'),
              transaction_type: value('transaction_type'),
              account_id: account.id,
              currency: account.currency,
              payee_id: value('payee_id') || null,
              category_id: value('category_id') || null,
              amount: moneyInput.parse(value('amount')),
              frequency: value('frequency'),
              start_date: value('start_date'),
              end_date: value('end_date') || null,
              enabled: form.get('enabled') === 'on',
              amount_is_approximate: approx,
              amount_tolerance: openingInput.parse(
                approx ? value('amount_tolerance') : '0',
              ),
            }
            write.mutate(
              {
                path: schedule ? `/schedules/${schedule.id}` : '/schedules',
                method: schedule ? 'PATCH' : 'POST',
                data,
              },
              { onSuccess: onSaved },
            )
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Invalid schedule')
          }
        }}
      >
        <fieldset disabled={write.isPending} className="form-grid">
          <Field label="Schedule name">
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={schedule?.name}
            />
          </Field>
          <Field label="Expected description">
            <input
              name="description"
              required
              maxLength={500}
              defaultValue={schedule?.description}
            />
          </Field>
          <Field label="Schedule account">
            <select
              name="account_id"
              required
              defaultValue={schedule?.account_id ?? ''}
            >
              <option value="">Choose account</option>
              {accounts
                .filter((a) => a.active || a.id === schedule?.account_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Schedule type">
            <select
              name="transaction_type"
              defaultValue={schedule?.transaction_type ?? 'EXPENSE'}
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </Field>
          <Field label="Expected amount">
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={schedule?.amount}
            />
          </Field>
          <Field label="Frequency">
            <select
              name="frequency"
              defaultValue={schedule?.frequency ?? 'MONTHLY'}
            >
              {frequencies.map((f) => (
                <option key={f} value={f}>
                  {label(f)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <input
              name="start_date"
              type="date"
              required
              defaultValue={schedule?.start_date ?? asOf}
            />
          </Field>
          <Field label="End date (optional)">
            <input
              name="end_date"
              type="date"
              defaultValue={schedule?.end_date ?? ''}
            />
          </Field>
          <PayeePicker
            initial={
              schedule?.payee_id
                ? { id: schedule.payee_id, name: payeeName ?? 'Selected payee' }
                : null
            }
          />
          <Field label="Schedule category">
            <select
              name="category_id"
              defaultValue={schedule?.category_id ?? ''}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Approximate amount">
            <input
              type="checkbox"
              checked={approx}
              onChange={(e) => setApprox(e.target.checked)}
            />
          </Field>
          {approx && (
            <Field label="Allowed amount difference">
              <input
                name="amount_tolerance"
                inputMode="decimal"
                required
                defaultValue={schedule?.amount_tolerance ?? '0'}
              />
            </Field>
          )}
          <Field label="Schedule enabled">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={schedule?.enabled ?? true}
            />
          </Field>
        </fieldset>
        <p className="metadata">
          Month-end dates retain their original anchor. Approximate amounts
          never post automatically. Matching requires the same account,
          currency, type and payee (or exact description), within the configured
          date/amount tolerance.
        </p>
        {(error || write.isError) && (
          <ErrorState text={error || write.error!.message} />
        )}
        <div className="flex gap-2 mt-4">
          <Button type="submit" disabled={write.isPending}>
            Save schedule
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={write.isPending}
            onClick={onSaved}
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}

function OccurrenceEditor({
  row,
  onClose,
}: {
  row: Occurrence
  onClose: () => void
}) {
  const candidates = useQuery({
    queryKey: ['schedule-candidates', row.schedule_id, row.due_date],
    queryFn: () => getCandidates(row),
    retry: false,
  })
  const write = useWrite()
  const [error, setError] = useState('')
  return (
    <section className="editor-surface">
      <h2>
        {row.name} · {row.due_date}
      </h2>
      <h3>Match existing transaction</h3>
      {candidates.isPending ? (
        <LoadingState text="Finding candidates…" />
      ) : candidates.isError ? (
        <ErrorState
          text={candidates.error.message}
          retry={() => void candidates.refetch()}
        />
      ) : (
        <>
          <p className="metadata">
            Date window: ±{candidates.data.date_tolerance_days} days. Allowed
            difference:{' '}
            <Money
              value={candidates.data.amount_tolerance}
              currency={row.currency}
            />
            . Nothing is matched automatically.
          </p>
          {candidates.data.ambiguous && (
            <p role="status">
              Multiple plausible matches. Inspect and explicitly choose the
              correct transaction.
            </p>
          )}
          {!candidates.data.candidates.length && (
            <EmptyState title="No matching transactions" />
          )}
          {candidates.data.candidates.map((t) => (
            <div className="automation-row" key={t.id}>
              <span>
                {t.transaction_date} · {t.payee?.name ?? t.description} ·{' '}
                {t.description} ·{' '}
                <Money value={t.amount} currency={t.currency} />
              </span>
              <Button
                disabled={write.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      'Associate this existing transaction? No ledger movement will be created.',
                    )
                  )
                    write.mutate(
                      {
                        path: `${occurrencePath(row)}/match`,
                        data: { transaction_id: t.id },
                      },
                      { onSuccess: onClose },
                    )
                }}
              >
                Confirm match
              </Button>
            </div>
          ))}
        </>
      )}
      <h3 className="mt-4">Create actual transaction</h3>
      <p className="metadata">
        Only use this when the event has occurred and is not already recorded.
        Confirm the actual amount, especially for estimates.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          const form = new FormData(e.currentTarget)
          try {
            const data = {
              amount: moneyInput.parse(String(form.get('actual_amount'))),
              transaction_date: String(form.get('actual_date')),
            }
            if (
              window.confirm(
                'Post this actual transaction and complete the occurrence? This changes the account balance.',
              )
            )
              write.mutate(
                { path: `${occurrencePath(row)}/post`, data },
                { onSuccess: onClose },
              )
          } catch (e) {
            setError((e as Error).message)
          }
        }}
      >
        <fieldset disabled={write.isPending} className="filter-bar">
          <Field label="Actual amount">
            <input
              name="actual_amount"
              inputMode="decimal"
              required
              defaultValue={row.amount_is_approximate ? '' : row.amount}
            />
          </Field>
          <Field label="Actual date">
            <input
              name="actual_date"
              type="date"
              required
              defaultValue={row.due_date}
            />
          </Field>
          <Button type="submit">Post actual transaction</Button>
        </fieldset>
      </form>
      {(error || write.isError) && (
        <ErrorState text={error || write.error!.message} />
      )}
      <Button
        className="mt-3"
        disabled={write.isPending}
        variant="outline"
        onClick={onClose}
      >
        Close occurrence
      </Button>
    </section>
  )
}
