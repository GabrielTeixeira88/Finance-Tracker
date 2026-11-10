import { useSpendingActions } from './compat'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/features/spending/components/transaction-row-actions.tsx; exact local data boundaries.
import { supportsFeature } from './compat'
import { useTranslation } from 'react-i18next'

import type { Account } from './compat'
import { AccountType } from './compat'
import { HOVER_SLOT } from './hover-slot'
import { cn } from '@/lib/utils'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icons,
} from './ui'

import { getEffectiveCashActivityType, isCreditCardAccountType } from './compat'
import {
  getTransactionDisplay,
  getTransferLinkStatus,
  isTransferCashActivity,
  type TransactionRowVM,
} from './compat'
import { canConvertToTransfer } from './compat'

export interface TransactionRowActionsProps {
  row: TransactionRowVM
  account: Account | undefined
  onMarkReimbursement: (row: TransactionRowVM) => void
  onEditSplits: (row: TransactionRowVM) => void
  onEdit: (row: TransactionRowVM) => void
  onDuplicate: (row: TransactionRowVM) => void
  onDelete: (row: TransactionRowVM) => void
  onLinkTransfer?: (row: TransactionRowVM) => void
  onUnlinkTransfer?: (row: TransactionRowVM) => void
  /** Count a withdrawal as a loan payment, or stop counting it. */
  onLoanPayment?: (row: TransactionRowVM) => void
  /** Classes for the menu button; the list shows it on row hover. */
  triggerClassName?: string
}

/** A Spending transaction's row menu, shared by the list and the grid. */
export function TransactionRowActions({
  row,
  account,
  onMarkReimbursement,
  onEditSplits,
  onEdit,
  onDuplicate,
  onDelete,
  onLinkTransfer,
  onUnlinkTransfer,
  onLoanPayment,
  triggerClassName = cn('data-popup-open:opacity-100 h-7 w-7', HOVER_SLOT),
}: TransactionRowActionsProps) {
  const { t } = useTranslation()
  const local = useSpendingActions()
  const a = row.activity
  const { isIncome, isNeutral } = getTransactionDisplay(a, account?.accountType)
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            disabled={local.busy}
            size="icon"
            className={triggerClassName}
            aria-label={t('wfSpending:transactions.rowActions')}
          />
        }
      >
        <Icons.MoreVertical className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(row)}>
          <Icons.Pencil className="me-2 h-4 w-4" aria-hidden="true" />
          {t('wfCommon:edit')}
        </DropdownMenuItem>
        {canMarkReimbursement && (
          <DropdownMenuItem onClick={() => onMarkReimbursement(row)}>
            <Icons.RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
            {t('wfSpending:transactions.markReimbursement')}
          </DropdownMenuItem>
        )}
        {!isNeutral && supportsFeature('splits') && (
          <DropdownMenuItem onClick={() => onEditSplits(row)}>
            <Icons.SplitHorizontal
              className="me-2 h-4 w-4"
              aria-hidden="true"
            />
            {t('wfSpending:transactions.splitTransaction')}
          </DropdownMenuItem>
        )}
        {row.canDuplicate && (
          <DropdownMenuItem onClick={() => onDuplicate(row)}>
            <Icons.Copy className="me-2 h-4 w-4" aria-hidden="true" />
            {t('wfSpending:transactions.duplicate')}
          </DropdownMenuItem>
        )}
        {isTransfer && (onLinkTransfer || onUnlinkTransfer) ? (
          transferLinkStatus === 'linked' ? (
            onUnlinkTransfer ? (
              <DropdownMenuItem onClick={() => onUnlinkTransfer(row)}>
                <Icons.Unlink className="me-2 h-4 w-4" aria-hidden="true" />
                {t('wfSpending:transactions.unlinkTransfer')}
              </DropdownMenuItem>
            ) : null
          ) : onLinkTransfer ? (
            <DropdownMenuItem onClick={() => onLinkTransfer(row)}>
              <Icons.Link className="me-2 h-4 w-4" aria-hidden="true" />
              {t('wfSpending:transactions.linkTransfer')}
            </DropdownMenuItem>
          ) : null
        ) : null}
        {onLinkTransfer && canConvertToTransfer(a) ? (
          <DropdownMenuItem onClick={() => onLinkTransfer(row)}>
            <Icons.ArrowLeftRight className="me-2 h-4 w-4" aria-hidden="true" />
            {t('wfSpending:transactions.convertToTransfer')}
          </DropdownMenuItem>
        ) : null}
        {canPayLoan && (
          <DropdownMenuItem onClick={() => onLoanPayment(row)}>
            <Icons.Link className="me-2 h-4 w-4" aria-hidden="true" />
            {t('wfAsset:loanPayments.menu')}
          </DropdownMenuItem>
        )}
        {local.inspect && (
          <DropdownMenuItem onClick={() => local.inspect?.(a.original)}>
            {t('transaction_table:evidence_clearing_856b2c')}
          </DropdownMenuItem>
        )}
        {row.canDelete && local.createRule && (
          <DropdownMenuItem onClick={() => local.createRule?.(a.original)}>
            {t('transaction_table:create_rule_69c3ac')}
          </DropdownMenuItem>
        )}
        {row.canDelete && (
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(row)}
          >
            <Icons.Trash className="me-2 h-4 w-4" aria-hidden="true" />
            {t('wfCommon:delete')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
