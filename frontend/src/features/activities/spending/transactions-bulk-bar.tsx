// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 transactions-bulk-bar.tsx, adapted to atomic selected-record metadata updates.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Transaction, Category } from '@/lib/api'
import { BulkTransactionActions } from '@/components/transaction-review'
import { ActivityEditor } from '../activity-editor'
import { Button, Icons } from '../../holdings/ui'
type Action = 'REVIEWED' | 'NEEDS_REVIEW' | 'category' | 'payee'
export function TransactionsBulkBar({
  rows,
  categories,
  onSaved,
  onClear,
  refreshing = false,
}: {
  rows: Transaction[]
  categories: Category[]
  onSaved: () => void
  onClear: () => void
  refreshing?: boolean
}) {
  const { t } = useTranslation()
  const [action, setAction] = useState<Action | null>(null)
  const special = rows.some(
    (row) => !['INCOME', 'EXPENSE'].includes(row.transaction_type),
  )
  const actions: { value: Action; label: string; restricted?: boolean }[] = [
    { value: 'REVIEWED', label: t('transaction_review:mark_reviewed_277c92') },
    {
      value: 'NEEDS_REVIEW',
      label: t('transaction_review:mark_needs_review_d32241'),
    },
    {
      value: 'category',
      label: t('transaction_review:assign_category_7dd454'),
      restricted: true,
    },
    {
      value: 'payee',
      label: t('transaction_review:assign_payee_aec2fb'),
      restricted: true,
    },
  ]
  return (
    <>
      <div
        role="region"
        aria-label={t('wfSpending:transactions.bulkActions')}
        className="bg-muted/40 ring-border flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 ring-1"
      >
        <div className="text-foreground flex items-center gap-2 text-sm">
          <Icons.Check className="size-4" aria-hidden="true" />
          <span className="font-medium">
            {t('wfSpending:transactions.selectedCount', { count: rows.length })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant="outline"
              disabled={refreshing || (special && item.restricted)}
              onClick={() => setAction(item.value)}
            >
              {item.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={onClear}>
            {t('wfCommon:clear')}
          </Button>
        </div>
      </div>
      {action && (
        <ActivityEditor
          title={actions.find((item) => item.value === action)!.label}
          onClose={() => setAction(null)}
        >
          <BulkTransactionActions
            rows={rows}
            categories={categories}
            refreshing={refreshing}
            initialAction={action}
            onSaved={onSaved}
          />
        </ActivityEditor>
      )}
    </>
  )
}
