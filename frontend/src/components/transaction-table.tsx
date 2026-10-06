import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState, Money } from '@/components/primitives'
import { label, type Account, type Category, type Transaction } from '@/lib/api'

export function TransactionTable({
  rows,
  accounts,
  categories,
  onEdit,
  onDelete,
  busy = false,
}: {
  rows: Transaction[]
  accounts: Account[]
  categories: Category[]
  onEdit?: (row: Transaction) => void
  onDelete?: (row: Transaction) => void
  busy?: boolean
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="No transactions match this view."
        detail="Add a transaction or adjust your filters."
      />
    )
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Transaction ledger"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description / merchant</th>
            <th scope="col">Category</th>
            <th scope="col">Account</th>
            <th scope="col">Type</th>
            <th scope="col" className="amount-cell">
              Amount
            </th>
            {onEdit && <th scope="col">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const transfer = row.transaction_type === 'TRANSFER'
            const tone =
              row.transaction_type === 'INCOME'
                ? 'positive'
                : row.transaction_type === 'EXPENSE'
                  ? 'negative'
                  : 'neutral'
            return (
              <tr key={row.id} data-kind={row.transaction_type}>
                <td className="date-cell">
                  {new Intl.DateTimeFormat(navigator.language, {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  }).format(new Date(`${row.transaction_date}T12:00:00`))}
                </td>
                <th scope="row" className="description-cell">
                  <span title={row.description}>{row.description}</span>
                  {row.merchant && <small>{row.merchant}</small>}
                </th>
                <td>
                  {categories.find((c) => c.id === row.category_id)?.name ??
                    '—'}
                </td>
                <td>
                  {accounts.find((a) => a.id === row.account_id)?.name ??
                    'Unknown account'}
                </td>
                <td>
                  <Badge>
                    {transfer && (
                      <ArrowLeftRight size={12} aria-hidden="true" />
                    )}
                    {label(row.transaction_type)}
                  </Badge>
                  {transfer && (
                    <small
                      className="transfer-link"
                      title={`Transfer ${row.transfer_id}`}
                    >
                      {row.direction === 'IN' ? 'Received' : 'Sent'} ·{' '}
                      {row.transfer_id?.slice(0, 8)}
                    </small>
                  )}
                </td>
                <td className="amount-cell">
                  <Money
                    value={row.amount}
                    currency={row.currency}
                    tone={tone}
                    prefix={transfer ? '' : row.direction === 'OUT' ? '−' : '+'}
                  />
                </td>
                {onEdit && (
                  <td>
                    {['INCOME', 'EXPENSE'].includes(row.transaction_type) ? (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onEdit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onDelete?.(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <span className="metadata">Read-only</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
