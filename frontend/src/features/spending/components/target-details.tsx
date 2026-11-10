import { useState } from 'react'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { ErrorState, SectionHeader } from '@/components/primitives'
import { type Category, openingInput } from '@/lib/api'
import { type BudgetRow, type BudgetReport } from '@/lib/budget-api'
import { useRoute } from '@/lib/navigation'
import { useWrite } from '@/lib/use-write'
import { t as tr } from '@/lib/i18n'
export function TargetEditor({
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
