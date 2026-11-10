// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 delete-transactions-dialog.tsx; exact amounts and local audit semantics.
import { useTranslation } from 'react-i18next'

import { useBalancePrivacy } from '../../holdings/compat'
import {} from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  useAmountFormatting,
} from './ui'

export interface DeletePreview {
  activityType: string
  amount: string | null
  currency: string
}

interface DeleteTransactionsDialogProps {
  open: boolean
  count: number
  preview?: DeletePreview
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

export function DeleteTransactionsDialog({
  open,
  count,
  preview,
  onConfirm,
  onCancel,
  isPending,
}: DeleteTransactionsDialogProps) {
  const formatting = useAmountFormatting()
  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()
  const previewAmount = isBalanceHidden
    ? '••••'
    : preview
      ? formatting.formatAmount(preview.amount, preview.currency)
      : '—'
  const message =
    count === 1 && preview
      ? t('wfSpending:transactions.deleteConfirmSingle', {
          type: preview.activityType.toLowerCase(),
          amount: previewAmount,
        })
      : t('wfSpending:transactions.deleteConfirmMany', { count })

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('wfSpending:transactions.deleteTitle', { count })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {message}{' '}
            {t(
              'dynamic:delete_this_transaction_the_record_will_remain_i_394bff',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t('wfCommon:cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            variant="destructive"
          >
            {t('wfCommon:delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
