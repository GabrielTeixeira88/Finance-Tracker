/* eslint-disable react-refresh/only-export-components -- Narrow compatibility exports for adapted source modules. */
import { createContext, useContext, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import type { Activity, Asset } from '@/lib/investments'
import type { Account } from '@/lib/api'
import { decimalUnits, unitsToMoney } from '@/lib/money'
import { navigateTo, useRoute } from '@/lib/navigation'
import type { FormattingApi } from '../holdings/number-formatters'
export { cn } from '@/lib/utils'

export const ActivityType = {
  BUY: 'BUY',
  SELL: 'SELL',
  DIVIDEND: 'DIVIDEND',
  INTEREST: 'INTEREST',
  FEE: 'FEE',
  TAX: 'TAX',
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  SPLIT: 'SPLIT',
} as const
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType]
export type ActivityDetails = {
  id: string
  assetId: string
  accountId: string
  assetSymbol: string
  assetName: string
  date: string
  activityType: ActivityType
  quantity: string
  unitPrice: string
  fee: string
  tax: string
  amount: string
  currency: string
  accountCurrency: string
  accountName: string
  exchangeMic: string
  instrumentType: string
  assetQuoteCcy: string
  comment: string
  cashBalance: string | null
  cashBalanceCurrency: string | null
  cashBalanceScope: 'DAY' | null
  subtype: string | null
  needsReview: false
  original: Activity
  fixedIncome: boolean
}
export function toActivity(
  row: Activity,
  accounts: Account[],
  assets: Asset[],
  fixedIncome = false,
): ActivityDetails {
  const asset = assets.find((a) => a.id === row.asset_id)
  const account = accounts.find((a) => a.id === row.account_id)
  return {
    id: row.id,
    assetId: row.asset_id ?? '',
    accountId: row.account_id,
    assetSymbol: asset?.symbol ?? '',
    assetName: asset?.name ?? '',
    date: row.activity_date,
    activityType: row.activity_type as ActivityType,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    fee: row.fees,
    tax: row.taxes,
    amount: row.gross_amount,
    currency: row.currency,
    accountCurrency: account?.currency ?? row.currency,
    accountName: account?.name ?? '',
    exchangeMic: asset?.exchange ?? '',
    instrumentType: asset?.asset_type ?? '',
    assetQuoteCcy: row.currency,
    comment: row.notes,
    cashBalance: null,
    cashBalanceCurrency: null,
    cashBalanceScope: null,
    subtype: null,
    needsReview: false,
    original: row,
    fixedIncome,
  }
}
export function calculateActivityValue(row: ActivityDetails) {
  return unitsToMoney(
    decimalUnits(row.original.cash_amount) *
      (row.original.direction === 'OUT' ? -1n : 1n),
  )
}
export const isIncomeActivity = (kind: string) =>
  ['DIVIDEND', 'INTEREST'].includes(kind)
export const isCashActivity = (kind: string) =>
  ['DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'FEE', 'TAX'].includes(kind)
export const isFeeActivity = (kind: string) => ['FEE', 'TAX'].includes(kind)
export const isAssetBackedIncomeActivity = (
  kind: string,
  _symbol: string,
  assetId: string,
) => isIncomeActivity(kind) && !!assetId
export const isCashTransfer = (
  kind: string,
  _symbol: string,
  assetId: string,
) => kind.startsWith('TRANSFER_') && !assetId
// Unsupported financial engines have no source records or mutation actions in this migration.
export const isSecuritiesTransfer = (
  _kind: string,
  _symbol: string,
  _assetId: string,
) => {
  void _kind
  void _symbol
  void _assetId
  return false
}
export const isSplitActivity = (kind: string) => kind === 'SPLIT'
export const isConversionRow = (_row: ActivityDetails) => {
  void _row
  return false
}
export const formatSplitRatio = (_value: unknown) => {
  void _value
  return '—'
}
export const getExchangeDisplayName = (exchange: string) => exchange
export const localizeActivityTypeName = (t: TFunction, kind: string) =>
  t(`wfActivity:type_${kind.toLowerCase()}`, { defaultValue: kind })
export const localizeActivitySubtypeName = localizeActivityTypeName
export const localizeActivityRowLabel = (t: TFunction, row: ActivityDetails) =>
  localizeActivityTypeName(t, row.activityType)
export const useSettingsContext = (): {
  settings: { timezone: string | undefined }
} => ({ settings: { timezone: undefined } })
export function formatDateTime(
  value: string | Date,
  formatter: FormattingApi,
  _timezone?: string,
  options?: Intl.DateTimeFormatOptions & { omitSeconds?: boolean },
) {
  void _timezone
  return { date: formatter.formatCalendarDate(value, options), time: '' }
}
export { isRowBodyClick } from '@/lib/row-click'
const DuplicateContext = createContext<(row: ActivityDetails) => Promise<void>>(
  async () => {
    throw new Error('Activity actions require a workspace')
  },
)
export const ActivityActionsProvider = DuplicateContext.Provider
export function useActivityMutations() {
  return {
    duplicateActivityMutation: { mutateAsync: useContext(DuplicateContext) },
  }
}
export function Link({
  to,
  children,
  ...props
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  const route = useRoute()
  const assetId = to.startsWith('/holdings/')
    ? decodeURIComponent(to.slice('/holdings/'.length))
    : ''
  return (
    <a
      {...props}
      href={`#/holdings?${new URLSearchParams({ asset: assetId, ...(route.accountId ? { account: route.accountId } : {}), ...(route.params.get('end') ? { end: route.params.get('end')! } : {}) })}`}
      onClick={(event) => {
        if (
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          event.button === 0 &&
          assetId
        ) {
          event.preventDefault()
          navigateTo('Investments', route.accountId, {
            view: 'Holdings',
            asset: assetId,
            ...(route.params.get('end')
              ? { end: route.params.get('end')! }
              : {}),
          })
        }
      }}
    >
      {children}
    </a>
  )
}
// The source's cloud-connect promotion is never enabled by the local controller.
export const connectPagePath = (_source: string) => {
  void _source
  return '#/settings'
}
export function InfiniteScrollTrigger({
  onLoadMore,
  hasNextPage,
  isFetching,
}: {
  onLoadMore: () => void
  hasNextPage: boolean
  isFetching?: boolean
  isFetchingNextPage?: boolean
  hasLoadMoreError?: boolean
}) {
  return hasNextPage ? (
    <button disabled={isFetching} onClick={onLoadMore}>
      Load more
    </button>
  ) : null
}
export const NEEDS_REVIEW_ROW_CLASS = ''
export const NEEDS_REVIEW_CARD_CLASS = ''
export const useReviewExplanation = () => ''
export const getProviderMappingReasons = (_row: ActivityDetails) => {
  void _row
  return []
}
// Investment activities are posted immutable entries, not ingestion review candidates.
// These unreachable source slots fail explicitly rather than inventing an investment review workflow.
export function NeedsReviewIcon(_props: Record<string, unknown>): ReactNode {
  void _props
  throw new Error('Use the existing ingestion review workflow')
}
export const NeedsReviewMark = NeedsReviewIcon
export function NeedsReviewStripe(): ReactNode {
  throw new Error('Use the existing ingestion review workflow')
}
