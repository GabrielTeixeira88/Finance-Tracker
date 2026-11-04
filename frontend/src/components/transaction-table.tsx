import { t as tr } from '@/lib/i18n'
import { getLocale } from '@/lib/preferences'
import { ArrowLeftRight, FileCheck2 } from 'lucide-react'
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
  selected,
  onSelect,
  onSelectPage,
  onInspect,
  onCreateRule,
}: {
  rows: Transaction[]
  accounts: Account[]
  categories: Category[]
  onEdit?: (row: Transaction) => void
  onDelete?: (row: Transaction) => void
  busy?: boolean
  selected?: string[]
  onSelect?: (id: string) => void
  onSelectPage?: () => void
  onCreateRule?: (row: Transaction) => void
  onInspect?: (row: Transaction) => void
}) {
  if (!rows.length)
    return (
      <EmptyState
        title={tr('transaction_table:no_transactions_match_this_view__aa3bbf')}
        detail={tr(
          'transaction_table:add_a_transaction_or_adjust_your_filters__77fcec',
        )}
      />
    )
  return (
    <div
      className="table-scroll transaction-ledger"
      tabIndex={0}
      role="region"
      aria-label={tr('transaction_table:transaction_ledger_a1a871')}
    >
      <table>
        <thead>
          <tr>
            {onSelect && (
              <th scope="col">
                <input
                  type="checkbox"
                  aria-label={tr(
                    'transaction_table:select_current_page_0e5f18',
                  )}
                  checked={rows.every((row) => selected?.includes(row.id))}
                  disabled={busy}
                  onChange={onSelectPage}
                />
              </th>
            )}
            <th scope="col">{tr('transaction_table:date_eb9a4b')}</th>
            <th scope="col">
              {tr('transaction_table:payee_description_94e3f8')}
            </th>
            <th scope="col">{tr('transaction_table:category_a3c686')}</th>
            <th scope="col">{tr('transaction_table:account_85dfa3')}</th>
            <th scope="col">{tr('transaction_table:type_3deb74')}</th>
            <th scope="col">{tr('transaction_table:status_bae7d5')}</th>
            <th scope="col" className="amount-cell">
              {tr('transaction_table:amount_43dc85')}
            </th>
            {onEdit && (
              <th scope="col">{tr('transaction_table:actions_c3cd63')}</th>
            )}
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
                {onSelect && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={tr('messages:message_4626e95dd5b8', {
                        value0: row.payee?.name ?? row.description,
                      })}
                      checked={selected?.includes(row.id) ?? false}
                      disabled={busy}
                      onChange={() => onSelect(row.id)}
                    />
                  </td>
                )}
                <td className="date-cell">
                  {new Intl.DateTimeFormat(getLocale(), {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  }).format(new Date(`${row.transaction_date}T12:00:00`))}
                </td>
                <th scope="row" className="description-cell">
                  <span title={row.description}>
                    {row.payee?.name ?? row.description}
                  </span>
                  {row.payee && row.payee.name !== row.description && (
                    <small>{row.description}</small>
                  )}
                  {row.merchant && <small>{row.merchant}</small>}
                </th>
                <td>
                  {categories.find(
                    (c) =>
                      c.id ===
                      (row.refund_purchase_id
                        ? row.spending_category_id
                        : row.category_id),
                  )?.name ?? '—'}
                </td>
                <td>
                  {accounts.find((a) => a.id === row.account_id)?.name ??
                    tr('dynamic:unknown_account_a6479b')}
                </td>
                <td>
                  <Badge>
                    {transfer && (
                      <ArrowLeftRight size={12} aria-hidden="true" />
                    )}
                    {row.refund_purchase_id
                      ? tr('dynamic:refund_e17c8a')
                      : label(row.transaction_type)}
                  </Badge>
                  {transfer && (
                    <small
                      className="transfer-link"
                      title={tr('messages:message_3c8c23023b21', {
                        value0: row.transfer_id,
                      })}
                    >
                      {row.direction === 'IN'
                        ? tr('dynamic:received_27548c')
                        : tr('dynamic:sent_35f49d')}{' '}
                      · {row.transfer_id?.slice(0, 8)}
                    </small>
                  )}
                </td>
                <td>
                  {onInspect && (
                    <button
                      className="icon-button ledger-evidence"
                      aria-label={tr(
                        'transaction_table:evidence_clearing_856b2c',
                      )}
                      title={tr(
                        'transaction_table:inspect_source_evidence_and_bank_clearing_143891',
                      )}
                      onClick={() => onInspect(row)}
                    >
                      <FileCheck2 size={14} aria-hidden="true" />
                    </button>
                  )}
                  {row.clearing_status && (
                    <small className="metadata block">
                      {label(row.clearing_status)}
                      {row.source_count
                        ? tr('messages:message_db2bb5c653ef', {
                            value0: row.source_count,
                          })
                        : ''}
                    </small>
                  )}
                  <Badge>
                    {row.review_status === 'NEEDS_REVIEW'
                      ? tr('dynamic:needs_review_33a506')
                      : tr('dynamic:reviewed_31ef85')}
                  </Badge>
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
                          {tr('transaction_table:edit_530164')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => onDelete?.(row)}
                        >
                          {tr('transaction_table:delete_f6fdbe')}
                        </Button>
                        {onCreateRule && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => onCreateRule(row)}
                          >
                            {tr('transaction_table:create_rule_69c3ac')}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => onEdit(row)}
                      >
                        {tr('transaction_table:review_e29a79')}
                      </Button>
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
