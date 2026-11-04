import { t as tr, ui } from '@/lib/i18n'
import { exactFormData } from '@/lib/localized-number'
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
  if (demo.isPending)
    return <LoadingState text={tr('schedules:loading_schedules__8ef1ac')} />
  if (demo.isError)
    return (
      <ErrorState
        text={tr('schedules:unable_to_load_schedule_context_b71a60')}
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
        title={tr('schedules:scheduled_transactions_a81cc8')}
        description={tr(
          'schedules:expected_events_separate_from_your_actual_ledger_38fdba',
        )}
      >
        <Button
          onClick={() => {
            setEditing(undefined)
            setCreating(!creating)
          }}
        >
          {creating
            ? tr('dynamic:close_schedule_form_3dbb2a')
            : tr('dynamic:create_schedule_cf7973')}
        </Button>
      </PageHeader>
      {demo && (
        <p className="metadata">
          {' '}
          {tr('schedules:synthetic_demo_calendar__d6e438')} {asOf}{' '}
          {tr('schedules:_no_events_are_posted_automatically__d5e727')}{' '}
        </p>
      )}
      <section className="panel">
        <h2>{tr('schedules:next_30_days_expected_cash_flow_2da609')}</h2>
        <p className="metadata">
          {tr(
            'schedules:uncompleted_occurrences_only_approximate_amounts_4cde6a',
          )}
        </p>
        {projected.isPending ? (
          <LoadingState text={tr('schedules:loading_projections__a68566')} />
        ) : projected.isError ? (
          <ErrorState
            text={tr('schedules:unable_to_load_projections_d9e104')}
            retry={() => void projected.refetch()}
          />
        ) : !projected.data.totals.length ? (
          <EmptyState
            title={tr('schedules:no_expected_cash_flow_in_this_period_db878f')}
          />
        ) : (
          projected.data.totals.map((t) => (
            <div className="filter-bar" key={t.currency}>
              <span>
                {' '}
                {tr('schedules:expected_income_adfcba')}{' '}
                <Money value={t.income} currency={t.currency} />
              </span>
              <span>
                {' '}
                {tr('schedules:expected_expenses_ec13e9')}{' '}
                <Money value={t.expenses} currency={t.currency} />
              </span>
              <span>
                {' '}
                {tr('schedules:expected_net_152b5f')}{' '}
                <Money value={t.net} currency={t.currency} />
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
        <h2>{tr('schedules:schedules_26d9d0')}</h2>
        {schedules.isPending ? (
          <LoadingState text={tr('schedules:loading_schedules__8ef1ac')} />
        ) : schedules.isError ? (
          <ErrorState
            text={tr('schedules:unable_to_load_schedules_a5890a')}
            retry={() => void schedules.refetch()}
          />
        ) : (
          <>
            {!schedules.data.length && (
              <EmptyState
                title={tr('schedules:no_schedules_yet_137b1c')}
                detail={tr(
                  'schedules:add_an_expected_salary_bill_or_one_time_event__646580',
                )}
              />
            )}
            {schedules.data.map((s) => (
              <div className="automation-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <p className="metadata">
                    {label(s.frequency)} ·{' '}
                    {s.enabled
                      ? tr('dynamic:enabled_df174a')
                      : tr('dynamic:disabled_f4f447')}{' '}
                    {tr('schedules:_next_outstanding__3513a2')}{' '}
                    {s.next_due_date ?? tr('dynamic:none_6eef66')} ·{' '}
                    {accounts.find((a) => a.id === s.account_id)?.name}
                  </p>
                  <p>
                    {payees.data?.find((p) => p.id === s.payee_id)?.name ??
                      s.description}{' '}
                    ·{' '}
                    {categories.find((c) => c.id === s.category_id)?.name ??
                      tr('dynamic:uncategorized_4ef7d7')}
                  </p>
                  <Money value={s.amount} currency={s.currency} />
                  {s.amount_is_approximate && (
                    <span className="metadata">
                      {tr('schedules:approximate_8ffc18')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={tr('messages:message_f8d9f06aa37b', {
                      value0: s.name,
                    })}
                    onClick={() => {
                      setCreating(false)
                      setEditing(s)
                    }}
                  >
                    {tr('schedules:edit_530164')}
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
                    {s.enabled
                      ? tr('dynamic:disable_9a7d4e')
                      : tr('dynamic:enable_20063a')}
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
                    {tr('schedules:delete_f6fdbe')}
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </section>
      <section className="panel">
        <h2>{tr('schedules:expected_occurrences_d93277')}</h2>
        <div className="filter-bar">
          <Field label={tr('schedules:schedule_range_from_c86903')}>
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
          <Field label={tr('schedules:schedule_range_to_327f89')}>
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
          <ErrorState text={tr('schedules:choose_a_valid_date_range_6cec40')} />
        ) : upcoming.isPending ? (
          <LoadingState
            text={tr('schedules:calculating_expected_occurrences__707d41')}
          />
        ) : upcoming.isError ? (
          <ErrorState
            text={upcoming.error.message}
            retry={() => void upcoming.refetch()}
          />
        ) : (
          <>
            {!upcoming.data.occurrences.length && (
              <EmptyState
                title={tr(
                  'schedules:no_active_occurrences_in_this_range_92705c',
                )}
              />
            )}
            <div
              className="table-scroll"
              role="region"
              aria-label={tr('schedules:scheduled_occurrences_53a2eb')}
              tabIndex={0}
            >
              <table aria-label={tr('schedules:scheduled_occurrences_53a2eb')}>
                <thead>
                  <tr>
                    <th>{tr('schedules:date_eb9a4b')}</th>
                    <th>{tr('schedules:event_account_962712')}</th>
                    <th>{tr('schedules:status_bae7d5')}</th>
                    <th className="amount-cell">
                      {tr('schedules:expected_amount_d01293')}
                    </th>
                    <th>{tr('schedules:actions_c3cd63')}</th>
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
                            ?.name ?? tr('dynamic:uncategorized_4ef7d7')}
                        </small>
                      </th>
                      <td>{label(o.status)}</td>
                      <td className="amount-cell">
                        <Money value={o.amount} currency={o.currency} />
                        {o.amount_is_approximate && (
                          <small className="metadata block">
                            {tr('schedules:estimate_235223')}
                          </small>
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
                                  tr(
                                    'dynamic:unlink_this_completion_the_real_ledger_transacti_32f3b4',
                                  ),
                                )
                              )
                                write.mutate({
                                  path: `${occurrencePath(o)}/match`,
                                  method: 'DELETE',
                                })
                            }}
                          >
                            {tr('schedules:unlink_completion_bac4fe')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelected(o)}
                          >
                            {tr('schedules:inspect_occurrence_03b3b6')}
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
      <h2>
        {schedule
          ? tr('dynamic:edit_schedule_9850bc')
          : tr('dynamic:new_schedule_3e70c3')}
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setError('')
          const form = exactFormData(event.currentTarget)
          const value = (key: string) => String(form.get(key) ?? '').trim()
          try {
            const account = accounts.find((a) => a.id === value('account_id'))
            if (!account) throw new Error(ui('Choose an account.'))
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
            setError(
              e instanceof Error
                ? e.message
                : tr('dynamic:invalid_schedule_09938d'),
            )
          }
        }}
      >
        <fieldset disabled={write.isPending} className="form-grid">
          <Field label={tr('schedules:schedule_name_fb63dc')}>
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={schedule?.name}
            />
          </Field>
          <Field label={tr('schedules:expected_description_a2910e')}>
            <input
              name="description"
              required
              maxLength={500}
              defaultValue={schedule?.description}
            />
          </Field>
          <Field label={tr('schedules:schedule_account_c162d3')}>
            <select
              name="account_id"
              required
              defaultValue={schedule?.account_id ?? ''}
            >
              <option value="">{tr('schedules:choose_account_9ccef0')}</option>
              {accounts
                .filter((a) => a.active || a.id === schedule?.account_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
            </select>
          </Field>
          <Field label={tr('schedules:schedule_type_de593f')}>
            <select
              name="transaction_type"
              defaultValue={schedule?.transaction_type ?? 'EXPENSE'}
            >
              <option value="EXPENSE">{tr('schedules:expense_a0db8e')}</option>
              <option value="INCOME">{tr('schedules:income_1c89b1')}</option>
            </select>
          </Field>
          <Field label={tr('schedules:expected_amount_d01293')}>
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={schedule?.amount}
            />
          </Field>
          <Field label={tr('schedules:frequency_89836a')}>
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
          <Field label={tr('schedules:start_date_ff99f5')}>
            <input
              name="start_date"
              type="date"
              required
              defaultValue={schedule?.start_date ?? asOf}
            />
          </Field>
          <Field label={tr('schedules:end_date_optional__41752f')}>
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
          <Field label={tr('schedules:schedule_category_5ef993')}>
            <select
              name="category_id"
              defaultValue={schedule?.category_id ?? ''}
            >
              <option value="">{tr('schedules:uncategorized_4ef7d7')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('schedules:approximate_amount_0bcc87')}>
            <input
              type="checkbox"
              checked={approx}
              onChange={(e) => setApprox(e.target.checked)}
            />
          </Field>
          {approx && (
            <Field label={tr('schedules:allowed_amount_difference_f99d10')}>
              <input
                name="amount_tolerance"
                inputMode="decimal"
                required
                defaultValue={schedule?.amount_tolerance ?? '0'}
              />
            </Field>
          )}
          <Field label={tr('schedules:schedule_enabled_8dd5f0')}>
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={schedule?.enabled ?? true}
            />
          </Field>
        </fieldset>
        <p className="metadata">
          {tr(
            'schedules:month_end_dates_retain_their_original_anchor_app_502c2d',
          )}
        </p>
        {(error || write.isError) && (
          <ErrorState text={error || write.error!.message} />
        )}
        <div className="flex gap-2 mt-4">
          <Button type="submit" disabled={write.isPending}>
            {tr('schedules:save_schedule_f22020')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={write.isPending}
            onClick={onSaved}
          >
            {tr('schedules:cancel_77dfd2')}
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
      <h3>{tr('schedules:match_existing_transaction_1098dd')}</h3>
      {candidates.isPending ? (
        <LoadingState text={tr('schedules:finding_candidates__16782c')} />
      ) : candidates.isError ? (
        <ErrorState
          text={candidates.error.message}
          retry={() => void candidates.refetch()}
        />
      ) : (
        <>
          <p className="metadata">
            {' '}
            {tr('schedules:date_window__efbf4e')}{' '}
            {candidates.data.date_tolerance_days}{' '}
            {tr('schedules:days_allowed_difference__533f3f')}{' '}
            <Money
              value={candidates.data.amount_tolerance}
              currency={row.currency}
            />{' '}
            {tr('schedules:_nothing_is_matched_automatically__109c27')}{' '}
          </p>
          {candidates.data.ambiguous && (
            <p role="status">
              {tr(
                'schedules:multiple_plausible_matches_inspect_and_explicitl_e68901',
              )}
            </p>
          )}
          {!candidates.data.candidates.length && (
            <EmptyState
              title={tr('schedules:no_matching_transactions_084a31')}
            />
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
                      tr(
                        'dynamic:associate_this_existing_transaction_no_ledger_mo_335f3e',
                      ),
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
                {tr('schedules:confirm_match_9bf512')}
              </Button>
            </div>
          ))}
        </>
      )}
      <h3 className="mt-4">
        {tr('schedules:create_actual_transaction_a91919')}
      </h3>
      <p className="metadata">
        {tr(
          'schedules:only_use_this_when_the_event_has_occurred_and_is_d79679',
        )}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          const form = exactFormData(e.currentTarget)
          try {
            const data = {
              amount: moneyInput.parse(String(form.get('actual_amount'))),
              transaction_date: String(form.get('actual_date')),
            }
            if (
              window.confirm(
                tr(
                  'dynamic:post_this_actual_transaction_and_complete_the_oc_896a27',
                ),
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
          <Field label={tr('schedules:actual_amount_9f2a38')}>
            <input
              name="actual_amount"
              inputMode="decimal"
              required
              defaultValue={row.amount_is_approximate ? '' : row.amount}
            />
          </Field>
          <Field label={tr('schedules:actual_date_3f7c9f')}>
            <input
              name="actual_date"
              type="date"
              required
              defaultValue={row.due_date}
            />
          </Field>
          <Button type="submit">
            {tr('schedules:post_actual_transaction_698af5')}
          </Button>
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
        {tr('schedules:close_occurrence_4dc34c')}
      </Button>
    </section>
  )
}
