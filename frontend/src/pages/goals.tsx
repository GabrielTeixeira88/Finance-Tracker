import { ArrowLeft, Plus } from 'lucide-react'
import { t as tr, ui } from '@/lib/i18n'
import { useDemoRuntime } from '@/lib/demo-runtime'
import { goalTitle, goalPercent } from '@/lib/goal-display'
import './goals.css'
import { GoalProgress } from '@/components/goal-progress'
import { TrajectoryChart } from '@/components/trajectory-chart'
import { DetailDrawer } from '@/components/detail-drawer'
import { useRoute, navigateTo } from '@/lib/navigation'
import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money as SharedMoney,
  PageHeader,
  SectionHeader,
} from '@/components/primitives'
import { localDate, type Account } from '@/lib/api'
import {
  getGoals,
  getGoal,
  getAllocations,
  type GoalDetail,
} from '@/lib/wealth-api'
import {
  activityPercent,
  decimalUnits,
  sumMoney,
  formatExactPercent,
} from '@/lib/money'
import { WealthChart, WealthForm } from './wealth'

function Money(props: { value: string; currency: string }) {
  return <SharedMoney {...props} fractionDigits={2} />
}
function NullableMoney({
  value,
  currency,
}: {
  value: string | null
  currency: string
}) {
  return value === null ? (
    <span className="metadata">{tr('common:unavailable')}</span>
  ) : (
    <Money value={value} currency={currency} />
  )
}

export default function Goals({ accounts }: { accounts: Account[] }) {
  const goals = useQuery({ queryKey: ['goals'], queryFn: getGoals })
  const allocations = useQuery({
    queryKey: ['goal-allocations'],
    queryFn: getAllocations,
  })
  const [create, setCreate] = useState(false)
  const route = useRoute()
  const selected = route.params.get('goal')
  const setSelected = (goal: string | null) =>
    navigateTo('Goals', undefined, {
      ...Object.fromEntries(route.params),
      goal: goal ?? '',
    })
  if (selected)
    return (
      <div className="goal-detail-page">
        <Button
          className="entity-back"
          variant="ghost"
          aria-label={tr('goals:goals_48d8c6')}
          onClick={() => setSelected(null)}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Button>
        <GoalView key={selected} id={selected} accounts={accounts} />
      </div>
    )
  return (
    <div className="goals-overview">
      <PageHeader
        title={tr('goals:goals_48d8c6')}
        description={tr('goals:overview_subtitle')}
      >
        <Button
          disabled={goals.isPending || goals.isError}
          onClick={() => setCreate(!create)}
        >
          <Plus size={14} aria-hidden="true" /> {tr('goals:add_goal_df1f45')}
        </Button>
      </PageHeader>
      {create && <GoalEditor onDone={() => setCreate(false)} />}
      {goals.isPending ? (
        <LoadingState text={tr('goals:loading_goals__4a1b81')} />
      ) : goals.isError ? (
        <ErrorState
          text={goals.error.message}
          retry={() => void goals.refetch()}
        />
      ) : (
        <>
          {[...new Set(goals.data.map((d) => d.goal.currency))].map(
            (currency) => {
              const active = goals.data.filter(
                (d) =>
                  d.goal.currency === currency && d.goal.status === 'ACTIVE',
              )
              return (
                <div className="wealth-metrics" key={currency}>
                  <span>
                    {' '}
                    {tr('goals:active_targets_496094')}{' '}
                    <Money
                      value={sumMoney(active.map((d) => d.goal.target))}
                      currency={currency}
                    />
                  </span>
                  <span>
                    {' '}
                    {tr('goals:saved_c0ae8f')}{' '}
                    <NullableMoney
                      value={
                        active.some((d) => d.saved === null)
                          ? null
                          : sumMoney(active.map((d) => d.saved ?? '0'))
                      }
                      currency={currency}
                    />
                  </span>
                  <span>
                    {' '}
                    {tr('goals:remaining_cc632b')}{' '}
                    <NullableMoney
                      value={
                        active.some((d) => d.remaining === null)
                          ? null
                          : sumMoney(active.map((d) => d.remaining ?? '0'))
                      }
                      currency={currency}
                    />
                  </span>
                </div>
              )
            },
          )}
          {!goals.data.length && (
            <EmptyState
              title={tr('goals:no_goals_yet_6bd524')}
              detail={tr(
                'goals:track_an_explicit_account_allocation_or_record_m_526f59',
              )}
            />
          )}
          <div className="goal-visual-grid">
            {goals.data.map((data) => (
              <GoalProgress
                key={data.goal.id}
                data={data}
                onOpen={() => setSelected(data.goal.id)}
              />
            ))}
          </div>
          <details className="financial-disclosure goal-funding-overview">
            <summary>{tr('goals:funding_overview')}</summary>
            <p className="metadata">{tr('goals:funding_description')}</p>
            {allocations.isPending ? (
              <LoadingState />
            ) : allocations.isError ? (
              <ErrorState
                text={allocations.error.message}
                retry={() => void allocations.refetch()}
              />
            ) : (
              <div className="table-scroll">
                <table className="finance-wealth-table">
                  <caption className="sr-only">
                    {tr('goals:funding_overview')}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{tr('goals:account_85dfa3')}</th>
                      <th scope="col" className="amount-cell">
                        {tr('goals:balance_90eef6')}
                      </th>
                      <th scope="col" className="amount-cell">
                        {tr('goals:allocated_c249df')}
                      </th>
                      <th scope="col" className="amount-cell">
                        {tr('goals:unallocated_bf44dd')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.data.map((a) => (
                      <tr key={a.account_id}>
                        <td>
                          {a.name}
                          {a.overallocated
                            ? tr('dynamic:_overallocated_22479a')
                            : ''}
                        </td>
                        {[a.balance, a.allocated, a.unallocated].map((v, i) => (
                          <td key={i} className="amount-cell">
                            <NullableMoney value={v} currency={a.currency} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </>
      )}
    </div>
  )
}

function GoalEditor({
  detail,
  onDone,
}: {
  detail?: GoalDetail
  onDone?: () => void
}) {
  const g = detail?.goal
  return (
    <WealthForm
      title={g ? tr('dynamic:edit_goal_2a9e72') : tr('dynamic:new_goal_22dcb4')}
      path={`/goals${g ? `/${g.id}` : ''}`}
      method={g ? 'PATCH' : 'POST'}
      onDone={onDone}
      transform={(d) => ({ ...d, deadline: d.deadline || null })}
    >
      <Field label={tr('goals:goal_name_3b4027')}>
        <input name="name" required maxLength={120} defaultValue={g?.name} />
      </Field>
      <Field label={tr('goals:tracking_mode_b9fcd9')}>
        <select name="mode" defaultValue={g?.mode ?? 'ACCOUNT'}>
          {(g ? [g.mode] : ['ACCOUNT', 'MANUAL']).map((m) => (
            <option key={m} value={m}>
              {m === 'ACCOUNT'
                ? tr('dynamic:account_allocations_ab4965')
                : tr('dynamic:manual_contributions_fa9467')}
            </option>
          ))}
        </select>
      </Field>
      <p className="metadata">
        {tr('goals:account_allocations_reserve_a_share_of_existing__43d009')}
      </p>
      <Field label={tr('goals:currency_e070de')}>
        <input
          name="currency"
          pattern="[A-Z]{3}"
          required
          readOnly={!!g}
          defaultValue={g?.currency ?? 'BRL'}
        />
      </Field>
      <Field label={tr('goals:target_61ad50')}>
        <input
          name="target"
          required
          inputMode="decimal"
          defaultValue={g?.target}
        />
      </Field>
      <Field label={tr('goals:start_date_ff99f5')}>
        <input
          name="start_date"
          type="date"
          required
          max={localDate()}
          defaultValue={g?.start_date ?? localDate()}
        />
      </Field>
      <Field label={tr('goals:deadline_optional__46588e')}>
        <input name="deadline" type="date" defaultValue={g?.deadline ?? ''} />
      </Field>
      <Field label={tr('goals:notes_704400')}>
        <textarea name="notes" defaultValue={g?.notes} />
      </Field>
    </WealthForm>
  )
}

function GoalView({ id, accounts }: { id: string; accounts: Account[] }) {
  const { runtime } = useDemoRuntime()
  const [monthly, setMonthly] = useState('0')
  const validMonthly = /^\d{1,18}(\.\d{1,6})?$/.test(monthly)
  const [edit, setEdit] = useState(false)
  const [posting, setPosting] = useState(false)
  const detail = useQuery({
    queryKey: ['goal', id, validMonthly ? monthly : '0'],
    queryFn: () => getGoal(id, validMonthly ? monthly : '0'),
    placeholderData: keepPreviousData,
  })
  if (detail.isPending) return <LoadingState />
  if (detail.isError)
    return (
      <ErrorState
        text={detail.error.message}
        retry={() => void detail.refetch()}
      />
    )
  const d = detail.data,
    g = d.goal
  return (
    <section>
      <SectionHeader title={goalTitle(g.name, !!runtime)} detail={g.notes}>
        <Button variant="ghost" onClick={() => setEdit(!edit)}>
          {tr('goals:edit_goal_2a9e72')}
        </Button>
      </SectionHeader>
      {edit && (
        <DetailDrawer
          title={tr('goals:edit_goal_2a9e72')}
          onClose={() => setEdit(false)}
        >
          <GoalEditor detail={d} onDone={() => setEdit(false)} />
        </DetailDrawer>
      )}
      {d.warnings.map((w) => (
        <ErrorState key={w} text={w} />
      ))}
      {d.funding_account_id && (
        <p className="metadata">{tr('real_market:goal_funding')}</p>
      )}
      <div className="goal-plan">
        <div className="goal-plan-main">
          <section className="goal-progress-panel">
            <SectionHeader
              title={tr('goals:goal_progress_5fef78')}
              detail={tr('parity:actual_progress')}
            />
            <p className="metadata">
              {ui(g.status)}
              {d.overdue ? tr('dynamic:_overdue_ad0efe') : ''} {g.deadline}
            </p>
            {!!d.milestones.length && (
              <p className="metadata">
                {tr('goals:milestones_reached__c564b2')}{' '}
                {d.milestones
                  .map((m) => formatExactPercent(String(m), 1, true))
                  .join(' / ')}
              </p>
            )}
            <div className="wealth-metrics">
              <div>
                {' '}
                {tr('goals:saved_c0ae8f')}{' '}
                <NullableMoney value={d.saved} currency={g.currency} />
              </div>
              <div>
                {' '}
                {tr('goals:remaining_cc632b')}{' '}
                <NullableMoney value={d.remaining} currency={g.currency} />
              </div>
              <div>
                {' '}
                {tr('goals:target_61ad50')}{' '}
                <NullableMoney value={g.target} currency={g.currency} />
              </div>
              <div>
                {tr('goals:deadline_2b12f3')}{' '}
                <span className="goal-deadline-value">
                  {g.deadline ?? tr('dynamic:no_deadline_c4a597')}
                </span>
              </div>
            </div>
            {d.progress !== null && (
              <div className="goal-actual-progress">
                <progress
                  aria-label={g.name}
                  aria-valuetext={goalPercent(d.progress)}
                  max={100}
                  value={
                    decimalUnits(g.target) === 0n
                      ? 100
                      : Math.min(
                          100,
                          Math.max(
                            0,
                            activityPercent(d.saved ?? '0', g.target, '0'),
                          ),
                        )
                  }
                />
                <p>
                  {goalPercent(d.progress)} -{' '}
                  <Money value={g.target} currency={g.currency} /> {g.deadline}
                </p>
              </div>
            )}
          </section>
          <section className="goal-monthly-plan">
            <span>{tr('goals:required_monthly_7d3d5c')}</span>
            <NullableMoney value={d.required_monthly} currency={g.currency} />
            <span>{tr('goals:projected_completion__8a0ad0')}</span>
            <span>{d.projected_completion ?? tr('common:unavailable')}</span>
          </section>
          <section className="goal-trajectory-panel">
            {d.trajectory ? (
              <TrajectoryChart data={d.trajectory} currency={g.currency} />
            ) : (
              <WealthChart
                points={d.history}
                currency={g.currency}
                label={tr('goals:goal_progress_5fef78')}
              />
            )}
          </section>
        </div>
        <aside>
          <SectionHeader
            title={tr('goals:savings_projection_3b5f4a')}
            detail={tr(
              'goals:hypothetical_scenario_not_a_forecast_or_ledger_p_568b3e',
            )}
          />
          <Field label={tr('goals:assumed_monthly_contribution_4cbced')}>
            <input
              inputMode="decimal"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
          </Field>
          <p>
            {' '}
            {tr('goals:projected_completion__8a0ad0')}{' '}
            {d.projected_completion ??
              tr(
                'dynamic:unavailable_set_a_positive_contribution_or_resol_af0471',
              )}
          </p>
          {!validMonthly && (
            <ErrorState
              text={tr(
                'goals:enter_a_nonnegative_decimal_contribution_with_at_868b7b',
              )}
            />
          )}
          <p className="metadata">
            {d.projection_method}{' '}
            {tr(
              'goals:required_monthly_saving_is_unavailable_without_a_736049',
            )}{' '}
          </p>
          {!d.funding_account_id &&
            !['ARCHIVED', 'COMPLETED'].includes(g.status) && (
              <Button onClick={() => setPosting(true)}>
                {g.mode === 'ACCOUNT'
                  ? tr('dynamic:set_dated_account_allocation_18ed76')
                  : tr('dynamic:record_progress_08b34b')}
              </Button>
            )}
        </aside>
      </div>
      {posting && (
        <DetailDrawer
          title={
            g.mode === 'ACCOUNT'
              ? tr('dynamic:set_dated_account_allocation_18ed76')
              : tr('dynamic:record_progress_08b34b')
          }
          onClose={() => setPosting(false)}
        >
          <WealthForm
            title={
              g.mode === 'ACCOUNT'
                ? tr('dynamic:set_dated_account_allocation_18ed76')
                : tr('dynamic:record_progress_08b34b')
            }
            path={`/goals/${id}/entries`}
            transform={(data) => ({
              ...data,
              account_id: data.account_id || null,
              direction: data.direction || 'IN',
            })}
          >
            {g.mode === 'ACCOUNT' ? (
              <Field label={tr('goals:savings_account_80fc8b')}>
                <select name="account_id" required>
                  <option value="">{tr('goals:choose_account_9ccef0')}</option>
                  {accounts
                    .filter(
                      (a) =>
                        a.active &&
                        a.currency === g.currency &&
                        ['CHECKING', 'SAVINGS', 'CASH'].includes(a.type),
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
            ) : (
              <Field label={tr('goals:adjustment_7f0496')}>
                <select name="direction">
                  <option value="IN">{tr('goals:contribution_982d5a')}</option>
                  <option value="OUT">
                    {tr('goals:withdrawal_negative_adjustment_d2245d')}
                  </option>
                </select>
              </Field>
            )}
            <Field label={tr('goals:effective_date_153c9b')}>
              <input
                type="date"
                name="effective_date"
                required
                min={g.start_date}
                max={localDate()}
                defaultValue={localDate()}
              />
            </Field>
            <Field
              label={
                g.mode === 'ACCOUNT'
                  ? tr(
                      'dynamic:total_allocation_replaces_previous_amount__100a97',
                    )
                  : tr('dynamic:amount_43dc85')
              }
            >
              <input name="amount" required inputMode="decimal" />
            </Field>
            <Field label={tr('goals:entry_notes_485bb6')}>
              <input name="notes" />
            </Field>
          </WealthForm>
        </DetailDrawer>
      )}
      <SectionHeader
        title={
          g.mode === 'ACCOUNT'
            ? tr('dynamic:allocation_history_44a8d8')
            : tr('dynamic:contribution_history_dc48e3')
        }
        detail={tr(
          'goals:corrections_preserve_the_original_record_shared__53dcb6',
        )}
      />
      <div className="table-scroll">
        <table className="finance-wealth-table">
          <thead>
            <tr>
              <th scope="col">{tr('goals:date_eb9a4b')}</th>
              <th scope="col">{tr('goals:account_direction_f3e58b')}</th>
              <th scope="col" className="amount-cell">
                {tr('goals:amount_43dc85')}
              </th>
              <th scope="col">{tr('goals:audit_fa1703')}</th>
            </tr>
          </thead>
          <tbody>
            {d.entries.map((e) => (
              <tr key={e.id}>
                <td>{e.effective_date}</td>
                <td>
                  {accounts.find((a) => a.id === e.account_id)?.name ??
                    e.direction}
                </td>
                <td className="amount-cell">
                  <Money value={e.amount} currency={g.currency} />
                </td>
                <td>
                  {e.voided_at ? (
                    `Voided: ${e.void_reason}`
                  ) : (
                    <details>
                      <summary>{tr('goals:correct_entry_0d0102')}</summary>
                      <WealthForm
                        title={tr('goals:void_entry_before_replacement_ccd337')}
                        path={`/goal-entries/${e.id}/void`}
                      >
                        <Field label={tr('goals:reason_f219cc')}>
                          <input name="reason" required />
                        </Field>
                      </WealthForm>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {g.status !== 'ARCHIVED' && (
        <WealthForm
          title={tr('goals:goal_lifecycle_72d8e7')}
          path={`/goals/${id}/status`}
        >
          <Field label={tr('goals:status_bae7d5')}>
            <select name="status" defaultValue={g.status}>
              {['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].map((s) => (
                <option key={s} value={s}>
                  {ui(s)}
                </option>
              ))}
            </select>
          </Field>
          <p className="metadata">
            {tr(
              'goals:archiving_releases_account_allocations_from_toda_490411',
            )}
          </p>
        </WealthForm>
      )}
    </section>
  )
}
