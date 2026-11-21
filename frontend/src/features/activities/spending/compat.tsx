/* eslint-disable react-refresh/only-export-components -- Source presentation adapter exports. */
import { createContext, useContext, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import type {
  Account as FinancialAccount,
  Transaction,
  Category,
} from '@/lib/api'
import { label } from '@/lib/api'
import type { EventReport } from '@/lib/life-events'
import { cn } from '@/lib/utils'
import { decimalUnits, unitsToMoney } from '@/lib/money'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
export type Account = FinancialAccount & { accountType: string }
export const AccountType = {
  CASH: 'CASH',
  CREDIT: 'CREDIT',
  CREDIT_CARD: 'CREDIT_CARD',
} as const
export type CashActivity = {
  id: string
  accountId: string
  activityDate: string
  activityType: string
  currency: string
  notes: string
  rawDescription: string
  cashBalance: string | null
  cashBalanceCurrency: string | null
  original: Transaction
}
export type TransactionRowVM = {
  activity: CashActivity
  category: {
    assignmentId: string
    taxonomyId: string
    id: string
    name: string
    color: null
    icon: null
    parentName: null
  } | null
  splitCount: 0
  needsReview: boolean
  canDuplicate: boolean
  canDelete: boolean
}
export function toSpendingRow(
  row: Transaction,
  categories: Category[],
  duplicate: boolean,
): TransactionRowVM {
  const category = categories.find(
    (c) =>
      c.id ===
      (row.refund_purchase_id ? row.spending_category_id : row.category_id),
  )
  const ordinary = ['INCOME', 'EXPENSE'].includes(row.transaction_type)
  return {
    activity: {
      id: row.id,
      accountId: row.account_id,
      activityDate: row.transaction_date,
      activityType: row.transaction_type,
      currency: row.currency,
      notes: row.payee?.name ?? row.description,
      rawDescription: row.description,
      cashBalance: null,
      cashBalanceCurrency: null,
      original: row,
    },
    category: category
      ? {
          id: category.id,
          name: category.name,
          taxonomyId: 'local_categories',
          assignmentId: row.id,
          color: null,
          icon: null,
          parentName: null,
        }
      : null,
    splitCount: 0,
    needsReview: row.review_status === 'NEEDS_REVIEW',
    canDuplicate: duplicate && ordinary && !row.refund_purchase_id,
    canDelete: ordinary,
  }
}
export function getTransactionDisplay(
  activity: CashActivity,
  _accountType?: string,
) {
  void _accountType
  const row = activity.original
  const neutral = ['TRANSFER', 'OPENING_BALANCE'].includes(row.transaction_type)
  return {
    isOutflow: !neutral && row.direction === 'OUT',
    isIncome:
      !neutral && row.transaction_type === 'INCOME' && !row.refund_purchase_id,
    isRefund: !!row.refund_purchase_id,
    isSaving: false,
    isNeutral: neutral,
    sign:
      row.transaction_type === 'TRANSFER'
        ? ''
        : row.direction === 'OUT'
          ? '−'
          : '+',
    safeAmount: unitsToMoney(decimalUnits(row.amount)),
  }
}
export const getCategoryLabel = (
  _t: TFunction,
  _taxonomy: string,
  _id: string,
  name: string,
) => {
  void _t
  void _taxonomy
  void _id
  return name
}
export const getEffectiveCashActivityType = (row: CashActivity): string =>
  row.original.transaction_type === 'INCOME'
    ? 'DEPOSIT'
    : row.original.transaction_type === 'EXPENSE'
      ? 'WITHDRAWAL'
      : row.original.transaction_type
export const isCreditCardAccountType = (kind?: string) => kind === 'CREDIT_CARD'
export const isTransferCashActivity = (row: CashActivity) =>
  row.original.transaction_type === 'TRANSFER'
export const getTransferLinkStatus = (row: CashActivity) =>
  row.original.transfer_id ? 'linked' : 'unlinked'
export const canConvertToTransfer = (_row: CashActivity) => {
  void _row
  return false
}
export const supportsFeature = (_feature: 'reimbursement' | 'splits') => {
  void _feature
  return false
}
export function bankRowMetadata(row: Transaction, t: TFunction) {
  const parts = [
    row.refund_purchase_id
      ? t('dynamic:refund_e17c8a')
      : label(row.transaction_type),
  ]
  if (row.transaction_type === 'TRANSFER')
    parts.push(
      t(
        row.direction === 'IN'
          ? 'dynamic:received_27548c'
          : 'dynamic:sent_35f49d',
      ),
    )
  if (row.clearing_status) parts.push(label(row.clearing_status))
  return parts.join(' · ')
}
export function CategoryIcon({
  className,
}: {
  icon?: string | null
  className?: string
}) {
  return <Icons.Tag className={className} aria-hidden="true" />
}
export function CategoryIconTile({
  className,
  iconClassName,
}: {
  icon?: string | null
  color?: string | null
  className?: string
  iconClassName?: string
}) {
  return (
    <span
      className={cn(
        'bg-muted/60 text-muted-foreground inline-flex items-center justify-center rounded',
        className,
      )}
    >
      <CategoryIcon className={iconClassName} />
    </span>
  )
}
export const NEEDS_REVIEW_ROW_CLASS = 'bg-warning/5'
export const NEEDS_REVIEW_CARD_CLASS = 'bg-warning/5'
export function NeedsReviewIcon({ label }: { label: string }) {
  return (
    <span role="img" aria-label={label} title={label} className="text-warning">
      <Icons.AlertCircle className="size-3.5" />
    </span>
  )
}
export const NeedsReviewMark = NeedsReviewIcon
export function NeedsReviewStripe() {
  return (
    <span
      className="bg-warning absolute inset-y-0 start-0 w-0.5"
      aria-hidden="true"
    />
  )
}
export type SpendingActions = {
  categories: Category[]
  events: EventReport[]
  busy: boolean
  rows: Transaction[]
  inspect?: (row: Transaction) => void
  createRule?: (row: Transaction) => void
}
const Context = createContext<SpendingActions | null>(null)
export const SpendingActionsProvider = Context.Provider
export function useSpendingActions() {
  const value = useContext(Context)
  if (!value) throw new Error('Spending actions require a workspace')
  return value
}
export function NoUnsupportedAction(): ReactNode {
  throw new Error('This financial engine was postponed')
}
