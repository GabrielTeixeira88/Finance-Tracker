import { bankRowMetadata, useSpendingActions } from './compat'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/features/spending/components/transaction-card.tsx; exact local data boundaries.
import { supportsFeature } from './compat'
import { getCategoryLabel } from './compat'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Account } from './compat'
import { AccountType } from './compat'
import { cn } from '@/lib/utils'
import { Card, Icons, PrivacyAmount } from './ui'

import { getEffectiveCashActivityType, isCreditCardAccountType } from './compat'
import {
  getTransactionDisplay,
  getTransferLinkStatus,
  isTransferCashActivity,
  type TransactionRowVM,
} from './compat'
import { ActionPalette } from '../../holdings/action-palette'
import { canConvertToTransfer } from './compat'

import { CategoryIcon } from './compat'
import { QuickCategorizePopover } from './quick-edit'
import { SelectionCheckbox } from './selection-checkbox'
import { QuickEventPopover } from './quick-edit'
import {
  NEEDS_REVIEW_CARD_CLASS,
  NeedsReviewMark,
  NeedsReviewStripe,
} from './compat'

interface TransactionCardProps {
  row: TransactionRowVM
  account: Account | undefined
  event: { id: string; name: string; eventTypeId: string } | null
  eventTypeColor: string | null
  appTimezone?: string
  /** True when the loaded result set spans more than one account. */
  showAccount: boolean
  /** Checkboxes only appear once the list is in selection mode. */
  selectionMode: boolean
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
}

/**
 * The meta line's tappable elements. No chip border or padding: on a card this
 * narrow those cost a line of their own, and the table row already shows
 * category and event as plain inline text.
 */
const INLINE =
  'hover:bg-muted/60 inline-flex min-w-0 items-center gap-1 overflow-hidden rounded transition-colors'

function TransactionCardImpl({
  row,
  account,
  event,
  eventTypeColor,
  showAccount,
  selectionMode,
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
}: TransactionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const { t } = useTranslation()
  const local = useSpendingActions()
  const a = row.activity
  const { isOutflow, isIncome, isSaving, isNeutral, sign, safeAmount } =
    getTransactionDisplay(a, account?.accountType)
  const accountName = account?.name ?? a.accountId
  const activityType = getEffectiveCashActivityType(a)
  const isTransfer = isTransferCashActivity(a)
  const transferLinkStatus = getTransferLinkStatus(a)
  const canMarkReimbursement =
    supportsFeature('reimbursement') &&
    isIncome &&
    !isCreditCardAccountType(account?.accountType) &&
    activityType !== 'CREDIT'
  // Loans take payments only as withdrawals from a cash account.
  const canPayLoan =
    !!onLoanPayment &&
    activityType === 'WITHDRAWAL' &&
    account?.accountType === AccountType.CASH

  return (
    <Card
      data-state={isSelected ? 'selected' : undefined}
      className={cn(
        'relative overflow-hidden p-2.5',
        row.needsReview && NEEDS_REVIEW_CARD_CLASS,
      )}
    >
      {/* Same leading marker the table row uses, so review state costs no width
          in the name and no height in the card. */}
      {row.needsReview && <NeedsReviewStripe />}
      {/* Centred rather than top-aligned: on a two-line card the selection
          control and the row menu read as belonging to the whole row, which is
          also how the investment activity card places them. */}
      <div className="flex items-center gap-2.5">
        {selectionMode && (
          <SelectionCheckbox
            checked={isSelected}
            disabled={local.busy}
            onCheckedChange={() => onToggleSelect(a.id)}
            aria-label={
              isSelected
                ? t('wfSpending:transactions.deselect')
                : t('wfSpending:transactions.select')
            }
            className="shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* See the table row: the amber stripe is decorative, so the state
                needs a form that survives both a screen reader and a reader who
                cannot separate the colours. */}
            {row.needsReview && (
              <NeedsReviewMark label={t('wfSpending:transactions.review')} />
            )}
            <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
              {a.notes ?? (
                <span className="text-muted-foreground italic">—</span>
              )}
            </span>
            <span
              className={cn(
                'shrink-0 text-sm font-medium tabular-nums',
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
            </span>
          </div>

          {a.notes !== a.rawDescription && (
            <p className="text-muted-foreground truncate text-xs">
              {a.rawDescription}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {bankRowMetadata(a.original, t)}
          </p>
          {/* Everything secondary shares one line: the day heading above owns
              the date, and the category sits inline the way the table row shows
              it rather than in a chip row of its own. */}
          <div className="text-muted-foreground text-2xs mt-0.5 flex items-center gap-1.5">
            {isNeutral && row.splitCount === 0 ? (
              <span className="shrink-0">
                {t('wfSpending:transactions.neutral')}
              </span>
            ) : a.original.refund_purchase_id ? (
              <span>{row.category?.name ?? '—'}</span>
            ) : row.splitCount > 0 ? (
              <button
                type="button"
                className={INLINE}
                onClick={() => onEditSplits(row)}
              >
                <Icons.SplitHorizontal
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">
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
                    className={cn(INLINE, 'max-w-[55%]')}
                  >
                    {row.category ? (
                      <>
                        {/* A tile is too small to read at this size; the bare icon
                            fits the 16px meta line like the split icon does. */}
                        <span
                          className="shrink-0"
                          style={{ color: row.category.color ?? undefined }}
                          aria-hidden="true"
                        >
                          <CategoryIcon
                            icon={row.category.icon}
                            className="h-3.5 w-3.5"
                          />
                        </span>
                        <span className="truncate">
                          {getCategoryLabel(
                            t,
                            row.category.taxonomyId,
                            row.category.id,
                            row.category.name,
                          )}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex min-w-0 items-center gap-0.5 italic">
                        <Icons.Plus
                          className="h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {t('wfSpending:transactions.categorize')}
                        </span>
                      </span>
                    )}
                  </button>
                }
              />
            )}

            {showAccount && (
              <>
                <span aria-hidden="true">·</span>
                <span className="min-w-0 flex-1 truncate">{accountName}</span>
              </>
            )}
            {/* Keeps the event slot pinned right when the account is absent. */}
            {!showAccount && <span className="flex-1" />}

            <QuickEventPopover
              selectedEventId={event?.id ?? null}
              onSelect={(eventId) => onSetEvent(a.id, eventId)}
              onClear={() => onSetEvent(a.id, null)}
              activityId={a.id}
              defaultDate={
                a.activityDate ? new Date(a.activityDate) : undefined
              }
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
                    INLINE,
                    event && 'bg-muted/60 max-w-[45%] rounded-full px-1.5',
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
                      <span className="truncate">{event.name}</span>
                    </>
                  ) : (
                    // Untagged: an icon rather than a chip, so a rarely-used
                    // slot costs a few pixels of width and no height.
                    <Icons.Tag
                      className="h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              }
            />
            {a.cashBalance != null && a.cashBalanceCurrency && (
              <span className="shrink-0 tabular-nums">
                {t('wfActivity:table_balance')}{' '}
                <PrivacyAmount
                  value={a.cashBalance}
                  currency={a.cashBalanceCurrency}
                />
              </span>
            )}
          </div>
        </div>

        {/* This card only renders on mobile, so the menu is always the touch
            presentation — the dropdown's 32px rows are mouse-sized for a list
            whose last entry is Delete. */}
        <ActionPalette
          open={menuOpen}
          onOpenChange={setMenuOpen}
          groups={[
            {
              items: [
                {
                  icon: Icons.Pencil,
                  label: t('wfCommon:edit'),
                  onClick: () => onEdit(row),
                },
                ...(canMarkReimbursement
                  ? [
                      {
                        icon: Icons.RefreshCw,
                        label: t('wfSpending:transactions.markReimbursement'),
                        onClick: () => onMarkReimbursement(row),
                      },
                    ]
                  : []),
                ...(!isNeutral && supportsFeature('splits')
                  ? [
                      {
                        icon: Icons.SplitHorizontal,
                        label: t('wfSpending:transactions.splitTransaction'),
                        onClick: () => onEditSplits(row),
                      },
                    ]
                  : []),
                ...(row.canDuplicate
                  ? [
                      {
                        icon: Icons.Copy,
                        label: t('wfSpending:transactions.duplicate'),
                        onClick: () => onDuplicate(row),
                      },
                    ]
                  : []),
                ...(local.inspect
                  ? [
                      {
                        icon: Icons.History,
                        label: t('transaction_table:evidence_clearing_856b2c'),
                        onClick: () => local.inspect?.(a.original),
                      },
                    ]
                  : []),
                ...(row.canDelete && local.createRule
                  ? [
                      {
                        icon: Icons.List,
                        label: t('transaction_table:create_rule_69c3ac'),
                        onClick: () => local.createRule?.(a.original),
                      },
                    ]
                  : []),
                ...(isTransfer &&
                transferLinkStatus === 'linked' &&
                onUnlinkTransfer
                  ? [
                      {
                        icon: Icons.Unlink,
                        label: t('wfSpending:transactions.unlinkTransfer'),
                        onClick: () => onUnlinkTransfer(row),
                      },
                    ]
                  : []),
                ...(isTransfer &&
                transferLinkStatus !== 'linked' &&
                onLinkTransfer
                  ? [
                      {
                        icon: Icons.Link,
                        label: t('wfSpending:transactions.linkTransfer'),
                        onClick: () => onLinkTransfer(row),
                      },
                    ]
                  : []),
                ...(onLinkTransfer && canConvertToTransfer(a)
                  ? [
                      {
                        icon: Icons.ArrowLeftRight,
                        label: t('wfSpending:transactions.convertToTransfer'),
                        onClick: () => onLinkTransfer(row),
                      },
                    ]
                  : []),
                ...(canPayLoan
                  ? [
                      {
                        icon: Icons.Link,
                        label: t('wfAsset:loanPayments.menu'),
                        onClick: () => onLoanPayment(row),
                      },
                    ]
                  : []),
              ],
            },
            {
              items: row.canDelete
                ? [
                    {
                      icon: Icons.Trash,
                      label: t('wfCommon:delete'),
                      onClick: () => onDelete(row),
                      variant: 'destructive' as const,
                    },
                  ]
                : [],
            },
          ]}
          trigger={
            <button
              type="button"
              disabled={local.busy}
              className="hover:bg-muted -me-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
              aria-label={t('wfSpending:transactions.rowActions')}
            >
              <Icons.MoreVertical className="h-4 w-4" aria-hidden="true" />
            </button>
          }
        />
      </div>
    </Card>
  )
}

export const TransactionCard = memo(TransactionCardImpl)
