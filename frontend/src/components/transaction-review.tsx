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
      <h2>Review transaction</h2>
      <p>
        {row.description} · {row.transaction_date} ·{' '}
        {label(row.transaction_type)}
      </p>
      <Money value={row.amount} currency={row.currency} />
      <p className="metadata">
        Posting details are protected.{' '}
        {row.transfer_id
          ? `Review changes apply to both sides of transfer ${row.transfer_id}.`
          : 'Opening balance remains part of financial history.'}
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
        <Field label="Review status">
          <select
            value={status}
            disabled={write.isPending}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="REVIEWED">Reviewed</option>
            <option value="NEEDS_REVIEW">Needs review</option>
          </select>
        </Field>
        {write.isError && <p role="alert">{write.error.message}</p>}
        <div className="flex gap-2 mt-3">
          <Button disabled={write.isPending} type="submit">
            Save review
          </Button>
          <Button
            variant="outline"
            type="button"
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
      <p role="status">{rows.length} selected on this page</p>
      <fieldset
        disabled={write.isPending || refreshing || !rows.length}
        className="filter-bar"
      >
        <Field label="Bulk action">
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setPayee('')
            }}
          >
            <option value="REVIEWED">Mark reviewed</option>
            <option value="NEEDS_REVIEW">Mark needs review</option>
            <option value="category" disabled={special}>
              Assign category
            </option>
            <option value="payee" disabled={special}>
              Assign payee
            </option>
          </select>
        </Field>
        {action === 'category' && (
          <Field label="Assign category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Uncategorized (clear)</option>
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
          Apply to selected
        </Button>
      </fieldset>
      {special && (
        <p className="metadata">
          Transfers and opening balances support review only. Transfer sides are
          reviewed together.
        </p>
      )}
      {write.isError && (
        <p role="alert">
          {write.error.message} Check the list before retrying.
        </p>
      )}
    </form>
  )
}
