import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
import { localDate, type Account } from '@/lib/api'
import {
  getGoals,
  getGoal,
  getAllocations,
  type GoalDetail,
} from '@/lib/wealth-api'
import { activityPercent, decimalUnits, sumMoney } from '@/lib/money'
import { NullableMoney, WealthChart, WealthForm } from './wealth'

export default function Goals({ accounts }: { accounts: Account[] }) {
  const goals = useQuery({ queryKey: ['goals'], queryFn: getGoals })
  const allocations = useQuery({
    queryKey: ['goal-allocations'],
    queryFn: getAllocations,
  })
  const [create, setCreate] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <>
      <PageHeader
        title="Goals"
        description="Plan savings without creating additional assets or moving money."
      >
        <Button
          disabled={goals.isPending || goals.isError}
          onClick={() => setCreate(!create)}
        >
          Add goal
        </Button>
      </PageHeader>
      {create && <GoalEditor onDone={() => setCreate(false)} />}
      {goals.isPending ? (
        <LoadingState text="Loading goals…" />
      ) : goals.isError ? (
        <ErrorState text={goals.error.message} />
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
                    Active targets{' '}
                    <Money
                      value={sumMoney(active.map((d) => d.goal.target))}
                      currency={currency}
                    />
                  </span>
                  <span>
                    Saved{' '}
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
                    Remaining{' '}
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
              title="No goals yet"
              detail="Track an explicit account allocation or record manual progress."
            />
          )}
          <div className="table-scroll">
            <table className="finance-wealth-table">
              <thead>
                <tr>
                  <th scope="col">Goal</th>
                  <th scope="col">Status</th>
                  <th scope="col">Deadline</th>
                  <th scope="col" className="amount-cell">
                    Saved
                  </th>
                  <th scope="col" className="amount-cell">
                    Target
                  </th>
                  <th scope="col">Progress</th>
                </tr>
              </thead>
              <tbody>
                {goals.data.map((d) => (
                  <tr key={d.goal.id}>
                    <td>
                      <button onClick={() => setSelected(d.goal.id)}>
                        {d.goal.name}
                      </button>
                      <p className="metadata">
                        {d.goal.mode === 'ACCOUNT'
                          ? 'Account allocation'
                          : 'Manual progress'}
                      </p>
                    </td>
                    <td>
                      {d.goal.status}
                      {d.overdue
                        ? ' · Overdue'
                        : d.near_deadline
                          ? ' · Due within 30 days'
                          : ''}
                    </td>
                    <td>{d.goal.deadline ?? 'No deadline'}</td>
                    <td className="amount-cell">
                      <NullableMoney
                        value={d.saved}
                        currency={d.goal.currency}
                      />
                    </td>
                    <td className="amount-cell">
                      <Money value={d.goal.target} currency={d.goal.currency} />
                    </td>
                    <td>
                      <progress
                        aria-label={`${d.goal.name} progress`}
                        max={100}
                        value={
                          d.saved === null
                            ? 0
                            : decimalUnits(d.goal.target) === 0n
                              ? 100
                              : Math.min(
                                  100,
                                  activityPercent(d.saved, d.goal.target, '0'),
                                )
                        }
                      />
                      <p className="metadata">
                        {d.warnings.join('; ') ||
                          d.milestones.map((m) => `${m}%`).join(' · ')}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <GoalView key={selected} id={selected} accounts={accounts} />
          )}
          <SectionHeader
            title="Shared savings"
            detail="Allocations reserve existing savings for planning only. They never add to net worth."
          />
          {allocations.isPending ? (
            <LoadingState />
          ) : allocations.isError ? (
            <ErrorState text={allocations.error.message} />
          ) : (
            <div className="table-scroll">
              <table className="finance-wealth-table">
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col" className="amount-cell">
                      Balance
                    </th>
                    <th scope="col" className="amount-cell">
                      Allocated
                    </th>
                    <th scope="col" className="amount-cell">
                      Unallocated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.data.map((a) => (
                    <tr key={a.account_id}>
                      <td>
                        {a.name}
                        {a.overallocated ? ' — Overallocated' : ''}
                      </td>
                      {[a.balance, a.allocated, a.unallocated].map((v, i) => (
                        <td key={i} className="amount-cell">
                          <Money value={v} currency={a.currency} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
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
      title={g ? 'Edit goal' : 'New goal'}
      path={`/goals${g ? `/${g.id}` : ''}`}
      method={g ? 'PATCH' : 'POST'}
      onDone={onDone}
      transform={(d) => ({ ...d, deadline: d.deadline || null })}
    >
      <Field label="Goal name">
        <input name="name" required maxLength={120} defaultValue={g?.name} />
      </Field>
      <Field label="Tracking mode">
        <select name="mode" defaultValue={g?.mode ?? 'ACCOUNT'}>
          {(g ? [g.mode] : ['ACCOUNT', 'MANUAL']).map((m) => (
            <option key={m} value={m}>
              {m === 'ACCOUNT' ? 'Account allocations' : 'Manual contributions'}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Currency">
        <input
          name="currency"
          pattern="[A-Z]{3}"
          required
          readOnly={!!g}
          defaultValue={g?.currency ?? 'BRL'}
        />
      </Field>
      <Field label="Target">
        <input
          name="target"
          required
          inputMode="decimal"
          defaultValue={g?.target}
        />
      </Field>
      <Field label="Start date">
        <input
          name="start_date"
          type="date"
          required
          max={localDate()}
          defaultValue={g?.start_date ?? localDate()}
        />
      </Field>
      <Field label="Deadline (optional)">
        <input name="deadline" type="date" defaultValue={g?.deadline ?? ''} />
      </Field>
      <Field label="Notes">
        <textarea name="notes" defaultValue={g?.notes} />
      </Field>
    </WealthForm>
  )
}

function GoalView({ id, accounts }: { id: string; accounts: Account[] }) {
  const [monthly, setMonthly] = useState('0')
  const validMonthly = /^\d{1,18}(\.\d{1,6})?$/.test(monthly)
  const [edit, setEdit] = useState(false)
  const detail = useQuery({
    queryKey: ['goal', id, validMonthly ? monthly : '0'],
    queryFn: () => getGoal(id, validMonthly ? monthly : '0'),
    placeholderData: keepPreviousData,
  })
  if (detail.isPending) return <LoadingState />
  if (detail.isError) return <ErrorState text={detail.error.message} />
  const d = detail.data,
    g = d.goal
  return (
    <section>
      <SectionHeader title={g.name} detail={g.notes}>
        <Button variant="ghost" onClick={() => setEdit(!edit)}>
          Edit goal
        </Button>
      </SectionHeader>
      {edit && <GoalEditor detail={d} onDone={() => setEdit(false)} />}
      {d.warnings.map((w) => (
        <ErrorState key={w} text={w} />
      ))}
      <div className="wealth-metrics">
        <div>
          Saved <NullableMoney value={d.saved} currency={g.currency} />
        </div>
        <div>
          Remaining <NullableMoney value={d.remaining} currency={g.currency} />
        </div>
        <div>
          Required monthly{' '}
          <NullableMoney value={d.required_monthly} currency={g.currency} />
        </div>
      </div>
      <WealthChart
        points={d.history}
        currency={g.currency}
        label="Goal progress"
      />
      <SectionHeader
        title="Savings projection"
        detail="Hypothetical scenario, not a forecast or ledger posting."
      />
      <Field label="Assumed monthly contribution">
        <input
          inputMode="decimal"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
        />
      </Field>
      <p>
        Projected completion:{' '}
        {d.projected_completion ??
          'Unavailable — set a positive contribution or resolve coverage'}
      </p>
      {!validMonthly && (
        <ErrorState text="Enter a nonnegative decimal contribution, with at most six decimal places." />
      )}
      <p className="metadata">
        {d.projection_method} Required monthly saving is unavailable without a
        future deadline.
      </p>
      {!['ARCHIVED', 'COMPLETED'].includes(g.status) && (
        <WealthForm
          title={
            g.mode === 'ACCOUNT'
              ? 'Set dated account allocation'
              : 'Record progress'
          }
          path={`/goals/${id}/entries`}
          transform={(data) => ({
            ...data,
            account_id: data.account_id || null,
            direction: data.direction || 'IN',
          })}
        >
          {g.mode === 'ACCOUNT' ? (
            <Field label="Savings account">
              <select name="account_id" required>
                <option value="">Choose account</option>
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
            <Field label="Adjustment">
              <select name="direction">
                <option value="IN">Contribution</option>
                <option value="OUT">Withdrawal / negative adjustment</option>
              </select>
            </Field>
          )}
          <Field label="Effective date">
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
                ? 'Total allocation (replaces previous amount)'
                : 'Amount'
            }
          >
            <input name="amount" required inputMode="decimal" />
          </Field>
          <Field label="Entry notes">
            <input name="notes" />
          </Field>
        </WealthForm>
      )}
      <SectionHeader
        title={
          g.mode === 'ACCOUNT' ? 'Allocation history' : 'Contribution history'
        }
        detail="Corrections preserve the original record. Shared allocations cannot exceed available savings."
      />
      <div className="table-scroll">
        <table className="finance-wealth-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Account / direction</th>
              <th scope="col" className="amount-cell">
                Amount
              </th>
              <th scope="col">Audit</th>
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
                      <summary>Correct entry</summary>
                      <WealthForm
                        title="Void entry before replacement"
                        path={`/goal-entries/${e.id}/void`}
                      >
                        <Field label="Reason">
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
        <WealthForm title="Goal lifecycle" path={`/goals/${id}/status`}>
          <Field label="Status">
            <select name="status" defaultValue={g.status}>
              {['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <p className="metadata">
            Archiving releases account allocations from today. Historical
            allocations remain visible.
          </p>
        </WealthForm>
      )}
    </section>
  )
}
