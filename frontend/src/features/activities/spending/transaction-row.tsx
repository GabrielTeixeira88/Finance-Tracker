import { bankRowMetadata, useSpendingActions } from './compat'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/features/spending/components/transaction-row.tsx; exact local data boundaries.
import { getCategoryLabel } from './compat'
import { memo, type Ref } from 'react'
import { useTranslation } from 'react-i18next'

import type { Account } from './compat'
import { TruncatedText } from './truncated-text'
import { HOVER_SLOT, SELECTION_SLOT } from './hover-slot'
import { isRowBodyClick } from '../activity-compat'
import { cn } from '@/lib/utils'
import { Checkbox, Icons, PrivacyAmount, TableCell, TableRow } from './ui'

import { getTransactionDisplay, type TransactionRowVM } from './compat'
import { CategoryIconTile } from './compat'
import { QuickCategorizePopover } from './quick-edit'
import { QuickEventPopover } from './quick-edit'
import { TransactionRowActions } from './transaction-row-actions'
import {
  NEEDS_REVIEW_ROW_CLASS,
  NeedsReviewIcon,
  NeedsReviewStripe,
} from './compat'

interface TransactionRowProps {
  row: TransactionRowVM
  account: Account | undefined
  event: { id: string; name: string; eventTypeId: string } | null
  eventTypeColor: string | null
  appTimezone?: string
  /** True when the loaded result set spans more than one account. */
  showAccount: boolean
  /** Adds the Balance cell: the list shows one account's running balance. */
  showBalance?: boolean
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onAssignCategory: (
    activityId: string,
    taxonomyId: string,
    categoryId: string,
  ) => void
  onClearCategory: (activityId: string, taxonomyId: string) => void
  onSetEvent: (activityId: string, eventId: string | null) => void
  onMarkReimbursement: (row: TransactionRowVM) => void
  onEditSplits: (row: TransactionRowVM) => void
  onEdit: (row: TransactionRowVM) => void
  onDuplicate: (row: TransactionRowVM) => void
  onDelete: (row: TransactionRowVM) => void
  onLinkTransfer?: (row: TransactionRowVM) => void
  onUnlinkTransfer?: (row: TransactionRowVM) => void
  /** Count a withdrawal as a loan payment, or stop counting it. */
  onLoanPayment?: (row: TransactionRowVM) => void
  /**
   * Virtualizer wiring: it measures the rendered row through the ref and
   * identifies it by `data-index`. Both are unset when the list renders
   * unvirtualized.
   */
  ref?: Ref<HTMLTableRowElement>
  'data-index'?: number
}

/** Shown only on row hover/focus, so an unset slot costs nothing at rest. */
function TransactionRowImpl({
  ref,
  'data-index': dataIndex,
  row,
  account,
  event,
  eventTypeColor,
  showAccount,
  showBalance = false,
  isSelected,
  onToggleSelect,
  onAssignCategory,
  onClearCategory,
  onSetEvent,
  onMarkReimbursement,
  onEditSplits,
  onEdit,
  onDuplicate,
  onDelete,
  onLinkTransfer,
  onUnlinkTransfer,
  onLoanPayment,
}: TransactionRowProps) {
  const { t } = useTranslation()
  const local = useSpendingActions()
  const a = row.activity
  const { isOutflow, isIncome, isSaving, isNeutral, sign, safeAmount } =
    getTransactionDisplay(a, account?.accountType)
  const accountName = account?.name ?? a.accountId
  const rowAriaLabel = isSelected
    ? t('wfSpending:transactions.deselect')
    : t('wfSpending:transactions.select')

  return (
    <TableRow
      ref={ref}
      data-index={dataIndex}
      data-state={isSelected ? 'selected' : undefined}
      className={cn(
        'group/row cursor-pointer',
        row.needsReview && NEEDS_REVIEW_ROW_CLASS,
      )}
      onClick={(e) => isRowBodyClick(e) && onEdit(row)}
    >
      <TableCell className="relative w-10 px-3 py-2" data-row-click-ignore>
        {row.needsReview && <NeedsReviewStripe />}
        <Checkbox
          checked={isSelected}
          disabled={local.busy}
          onCheckedChange={() => onToggleSelect(a.id)}
          aria-label={`${rowAriaLabel}: ${a.notes}`}
          className={SELECTION_SLOT}
        />
      </TableCell>
      {/* `max-w-0` hands this column whatever width the fixed-width columns
          leave over, instead of letting a long note stretch the table. It has
          to be `!important`: globals.css sets `max-width: 100vw` on every
          element at or below 1024px from outside any layer, which beats a
          plain utility and would let the note run to the viewport edge. */}
      <TableCell className="max-w-0! px-3 py-2">
        <div className="flex items-center gap-2">
          {row.needsReview && (
            <NeedsReviewIcon label={t('wfSpending:transactions.review')} />
          )}
          {a.notes != null ? (
            <div className="min-w-0 flex-1">
              <TruncatedText text={a.notes} className="text-sm" />
              {a.rawDescription !== a.notes && (
                <span className="text-muted-foreground block truncate text-xs">
                  {a.rawDescription}
                </span>
              )}
              <span className="text-muted-foreground text-xs">
                {bankRowMetadata(a.original, t)}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm italic">—</span>
          )}
          {showAccount && (
            <span className="text-muted-foreground max-w-[8rem] shrink-0 truncate text-xs">
              {accountName}
            </span>
          )}
          <QuickEventPopover
            selectedEventId={event?.id ?? null}
            onSelect={(eventId) => onSetEvent(a.id, eventId)}
            onClear={() => onSetEvent(a.id, null)}
            activityId={a.id}
            defaultDate={a.activityDate ? new Date(a.activityDate) : undefined}
            trigger={
              <button
                type="button"
                aria-label={
                  event
                    ? t('wfSpending:transactions.changeEvent', {
                        name: event.name,
                      })
                    : t('wfSpending:transactions.tagEvent')
                }
                className={cn(
                  'hover:bg-muted/60 inline-flex shrink-0 items-center gap-1.5 rounded-full transition-colors',
                  event
                    ? 'bg-muted/60 max-w-[10rem] px-2 py-0.5'
                    : cn('px-1', HOVER_SLOT),
                )}
              >
                {event ? (
                  <>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          eventTypeColor ?? 'var(--muted-foreground)',
                      }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-xs">{event.name}</span>
                  </>
                ) : (
                  <Icons.Tag
                    className="text-muted-foreground h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                )}
              </button>
            }
          />
        </div>
      </TableCell>
      <TableCell className="hidden w-44 px-3 py-2 sm:table-cell">
        {isNeutral && row.splitCount === 0 ? (
          <span className="text-muted-foreground text-xs">
            {t('wfSpending:transactions.neutral')}
          </span>
        ) : a.original.refund_purchase_id ? (
          <span className="text-muted-foreground text-sm">
            {row.category?.name ?? '—'}
          </span>
        ) : row.splitCount > 0 ? (
          <button
            type="button"
            className="hover:bg-muted/60 -mx-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-start transition-colors"
            onClick={() => onEditSplits(row)}
          >
            <Icons.SplitHorizontal
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate text-sm">
              {t('wfSpending:transactions.splitLines', {
                count: row.splitCount,
              })}
            </span>
          </button>
        ) : (
          <QuickCategorizePopover
            scope={isIncome ? 'income' : isSaving ? 'saving' : 'expense'}
            selectedCategoryId={row.category?.id ?? null}
            onSelect={(taxonomyId, categoryId) =>
              onAssignCategory(a.id, taxonomyId, categoryId)
            }
            onClear={() =>
              row.category && onClearCategory(a.id, row.category.taxonomyId)
            }
            trigger={
              <button
                type="button"
                aria-label={
                  row.category
                    ? t('wfSpending:transactions.changeCategory', {
                        name: getCategoryLabel(
                          t,
                          row.category.taxonomyId,
                          row.category.id,
                          row.category.name,
                        ),
                      })
                    : t('wfSpending:transactions.assignCategory')
                }
                className="hover:bg-muted/60 -mx-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-start transition-colors"
              >
                {row.category ? (
                  <>
                    {/* h-5 matches the text-sm line height, so the row keeps its height. */}
                    <CategoryIconTile
                      icon={row.category.icon}
                      color={row.category.color}
                      className="h-5 w-5"
                      iconClassName="h-3 w-3"
                    />
                    <span className="truncate text-sm">
                      {getCategoryLabel(
                        t,
                        row.category.taxonomyId,
                        row.category.id,
                        row.category.name,
                      )}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs italic">
                    <Icons.Plus className="h-3 w-3" aria-hidden="true" />
                    {t('wfSpending:transactions.categorize')}
                  </span>
                )}
              </button>
            }
          />
        )}
      </TableCell>
      <TableCell
        className={cn(
          'w-28 whitespace-nowrap px-3 py-2 text-end text-sm font-medium tabular-nums',
          isSaving
            ? 'text-[#6B8E54]'
            : isOutflow
              ? 'text-destructive'
              : isNeutral
                ? 'text-muted-foreground'
                : 'text-success',
        )}
      >
        {sign}
        <PrivacyAmount value={safeAmount} currency={a.currency} />
      </TableCell>
      {showBalance && (
        <TableCell className="text-muted-foreground hidden w-28 px-3 py-2 text-end text-sm whitespace-nowrap tabular-nums sm:table-cell">
          {a.cashBalance != null && a.cashBalanceCurrency && (
            <PrivacyAmount
              value={a.cashBalance}
              currency={a.cashBalanceCurrency}
            />
          )}
        </TableCell>
      )}
      <TableCell className="w-10 px-3 py-2" data-row-click-ignore>
        <TransactionRowActions
          row={row}
          account={account}
          onMarkReimbursement={onMarkReimbursement}
          onEditSplits={onEditSplits}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onLinkTransfer={onLinkTransfer}
          onUnlinkTransfer={onUnlinkTransfer}
          onLoanPayment={onLoanPayment}
        />
      </TableCell>
    </TableRow>
  )
}

export const TransactionRow = memo(TransactionRowImpl)
