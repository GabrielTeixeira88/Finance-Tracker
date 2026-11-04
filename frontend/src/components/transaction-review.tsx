import { t as tr } from '@/lib/i18n'
import { useState } from 'react'
import { Field } from './forms'
import { Button } from './ui/button'
import { Money } from './primitives'
import { PayeePicker } from './payee-picker'
import { type Category, type Transaction, label } from '@/lib/api'
import { useWrite } from '@/lib/use-write'

export function ReviewTransaction({
  row,
  onSaved,
}: {
  row: Transaction
  onSaved: () => void
}) {
  const [status, setStatus] = useState(row.review_status)
  const write = useWrite()
  return (
    <section className="editor-surface">
      <h2>{tr('transaction_review:review_transaction_a248f5')}</h2>
      <p>
        {row.description} · {row.transaction_date} ·{' '}
        {label(row.transaction_type)}
      </p>
      <Money value={row.amount} currency={row.currency} />
      <p className="metadata">
        {' '}
        {tr('transaction_review:posting_details_are_protected__31f359')}{' '}
        {row.transfer_id
          ? tr('messages:message_05040175434b', { value0: row.transfer_id })
          : tr(
              'dynamic:opening_balance_remains_part_of_financial_histor_f54bd6',
            )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          write.mutate(
            {
              path: `/transactions/${row.id}`,
              method: 'PATCH',
              data: { review_status: status },
            },
            { onSuccess: onSaved },
          )
        }}
      >
        <Field label={tr('transaction_review:review_status_0fe6b8')}>
          <select
            value={status}
            disabled={write.isPending}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="REVIEWED">
              {tr('transaction_review:reviewed_31ef85')}
            </option>
            <option value="NEEDS_REVIEW">
              {tr('transaction_review:needs_review_33a506')}
            </option>
          </select>
        </Field>
        {write.isError && <p role="alert">{write.error.message}</p>}
        <div className="flex gap-2 mt-3">
          <Button disabled={write.isPending} type="submit">
            {tr('transaction_review:save_review_f450a9')}
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={write.isPending}
            onClick={onSaved}
          >
            {tr('transaction_review:cancel_77dfd2')}
          </Button>
        </div>
      </form>
    </section>
  )
}

export function BulkTransactionActions({
  rows,
  categories,
  onSaved,
  refreshing = false,
}: {
  rows: Transaction[]
  categories: Category[]
  onSaved: () => void
  refreshing?: boolean
}) {
  const [action, setAction] = useState('REVIEWED')
  const [category, setCategory] = useState('')
  const [payee, setPayee] = useState('')
  const write = useWrite()
  const special = rows.some(
    (row) => !['INCOME', 'EXPENSE'].includes(row.transaction_type),
  )
  const invalid = special && ['category', 'payee'].includes(action)
  return (
    <form
      className="bulk-actions"
      onSubmit={(event) => {
        event.preventDefault()
        if (
          invalid ||
          !window.confirm(
            `Update ${rows.length} selected transaction(s)? Transfer review also updates the linked side, even if it is outside this filter. No monetary values will change.`,
          )
        )
          return
        const changes =
          action === 'category'
            ? { category_id: category || null }
            : action === 'payee'
              ? { payee_id: payee || null }
              : { review_status: action }
        write.mutate(
          {
            path: '/transactions/bulk',
            method: 'PATCH',
            data: { transaction_ids: rows.map((row) => row.id), changes },
          },
          { onSuccess: onSaved },
        )
      }}
    >
      <p role="status">
        {rows.length}{' '}
        {tr('transaction_review:selected_on_this_page_66d6f6')}{' '}
      </p>
      <fieldset
        disabled={write.isPending || refreshing || !rows.length}
        className="filter-bar"
      >
        <Field label={tr('transaction_review:bulk_action_a3f85d')}>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setPayee('')
            }}
          >
            <option value="REVIEWED">
              {tr('transaction_review:mark_reviewed_277c92')}
            </option>
            <option value="NEEDS_REVIEW">
              {tr('transaction_review:mark_needs_review_d32241')}
            </option>
            <option value="category" disabled={special}>
              {tr('transaction_review:assign_category_7dd454')}
            </option>
            <option value="payee" disabled={special}>
              {tr('transaction_review:assign_payee_aec2fb')}
            </option>
          </select>
        </Field>
        {action === 'category' && (
          <Field label={tr('transaction_review:assign_category_7dd454')}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">
                {tr('transaction_review:uncategorized_clear__e10b92')}
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {action === 'payee' && <PayeePicker onChange={setPayee} />}
        <Button type="submit" disabled={invalid || write.isPending}>
          {tr('transaction_review:apply_to_selected_5e7867')}
        </Button>
      </fieldset>
      {special && (
        <p className="metadata">
          {tr(
            'transaction_review:transfers_and_opening_balances_support_review_on_701201',
          )}
        </p>
      )}
      {write.isError && (
        <p role="alert">
          {write.error.message}{' '}
          {tr('transaction_review:check_the_list_before_retrying__9397fb')}{' '}
        </p>
      )}
    </form>
  )
}
