import { decimalUnits } from '@/lib/money'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/pages/activity/components/activity-table/activity-table-mobile.tsx; exact local adapters.
import { useCallback, useMemo } from 'react'

import { TickerAvatar } from '../holdings/formatting'
import {
  calculateActivityValue,
  formatSplitRatio,
  isAssetBackedIncomeActivity,
  isCashActivity,
  isCashTransfer,
  isConversionRow,
  isFeeActivity,
  isIncomeActivity,
  isSecuritiesTransfer,
  isSplitActivity,
  localizeActivityRowLabel,
} from './activity-compat'
import { ActivityType } from './activity-compat'
import { formatOptionSubtitle, parseOccSymbol } from '../holdings/compat'
import { useSettingsContext } from './activity-compat'
import type { ActivityDetails } from './activity-compat'
import { formatDateTime, cn } from './activity-compat'
import {
  AmountDisplay,
  Button,
  Icons,
  PriceDisplay,
  Separator,
  useAmountFormatting,
  useDateFormatting,
  buttonVariants,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '../holdings/ui'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'
import { Link } from './activity-compat'
import { connectPagePath } from './activity-compat'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { InfiniteScrollTrigger } from './activity-compat'
import { useBalancePrivacy } from '../holdings/compat'
import {
  observeCurrentScrollOffset,
  useVirtualScrollContainer,
} from './use-virtual-scroll-container'
import { ActivityOperations } from './activity-operations'
import { ActivityTypeBadge } from './activity-type-badge'
import { flattenDayGroups } from './day-groups'
import { groupActivitiesByDay } from './activity-day-groups'
import { ActivityDayHeading } from './activity-day-header'
import {
  NEEDS_REVIEW_CARD_CLASS,
  NeedsReviewMark,
  NeedsReviewStripe,
} from './activity-compat'

/**
 * Starting heights for virtualized cards. The detailed card grows with the
 * fields an activity carries, so this is only a starting point — each card
 * reports its real height once measured.
 */
const COMPACT_CARD_HEIGHT = 88
const DETAILED_CARD_HEIGHT = 300
const DAY_HEADING_HEIGHT = 24
/** `space-y-2`, moved into the virtualizer's layout maths. */
const CARD_GAP = 8
/** Cards kept mounted past the viewport edge, so a fast flick stays painted. */
const OVERSCAN = 5

interface ActivityTableMobileProps {
  activities: ActivityDetails[]
  isLoading?: boolean
  isCompactView: boolean
  /**
   * Puts a heading above each day's cards. Only for a list the server returned
   * in date order, where each day is one run of cards.
   */
  groupByDay?: boolean
  handleEdit: (activity?: ActivityDetails) => void
  handleDelete: (activity: ActivityDetails) => void
  onDuplicate: (activity: ActivityDetails) => Promise<void>
  onLinkTransfer?: (activity: ActivityDetails) => void
  onUnlinkTransfer?: (activity: ActivityDetails) => void
  filtersActive?: boolean
  onAdd?: () => void
  /** Show a "Connect Account" button next to the add button when there are no activities. */
  showConnectAccountLink?: boolean
  onClearFilters?: () => void
  onLoadMore?: () => void
  hasNextPage?: boolean
  isFetching?: boolean
  isFetchingNextPage?: boolean
  hasLoadMoreError?: boolean
}

export const ActivityTableMobile = ({
  activities,
  isLoading = false,
  isCompactView,
  groupByDay = false,
  handleEdit,
  handleDelete,
  onDuplicate,
  onLinkTransfer,
  onUnlinkTransfer,
  filtersActive = false,
  onAdd,
  showConnectAccountLink = false,
  onClearFilters,
  onLoadMore,
  hasNextPage = false,
  isFetching,
  isFetchingNextPage = false,
  hasLoadMoreError = false,
}: ActivityTableMobileProps) => {
  const amountFormatting = useAmountFormatting()
  const dateFormatting = useDateFormatting()
  const { isBalanceHidden } = useBalancePrivacy()
  const { t } = useTranslation()
  const { settings } = useSettingsContext()
  const appTimezone = settings?.timezone?.trim() || undefined

  // Day headings interleave with the cards, so the virtualizer counts both.
  const listItems = useMemo(() => {
    if (!groupByDay) {
      return activities.map((activity) => ({
        kind: 'row' as const,
        key: activity.id,
        item: activity,
      }))
    }
    const groups = groupActivitiesByDay(
      activities,
      (activity) => activity,
      (activity) =>
        formatDateTime(activity.date, dateFormatting, appTimezone).date,
    )
    return flattenDayGroups(groups, (activity) => activity.id)
  }, [activities, appTimezone, dateFormatting, groupByDay])

  // Embedded lists can share an already-scrolled page rather than their own box.
  const { listRef, scrollElement, scrollMargin } = useVirtualScrollContainer()

  /**
   * Measured heights are cached under this key, and the detailed card is
   * several times the height of the compact one — so the view has to be part
   * of the identity, or a card would be laid out at the height it had under
   * the other view. Changing the key also remounts the row, which is what
   * makes it re-measure: `measureElement` is a stable callback ref, so React
   * never re-runs it for a row that merely re-rendered.
   */
  const getItemKey = useCallback(
    (index: number) =>
      `${isCompactView ? 'compact' : 'detailed'}:${listItems[index]?.key ?? index}`,
    [listItems, isCompactView],
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- Pinned source TanStack virtualization; React Compiler is not enabled.
  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => scrollElement,
    // Seed the offset before the virtualizer's initial scrollTo. Swipeable views
    // mount neighboring lists while the shared page may already be scrolled.
    observeElementOffset: observeCurrentScrollOffset,
    estimateSize: (index) =>
      listItems[index]?.kind === 'header'
        ? DAY_HEADING_HEIGHT
        : isCompactView
          ? COMPACT_CARD_HEIGHT
          : DETAILED_CARD_HEIGHT,
    getItemKey,
    overscan: OVERSCAN,
    scrollMargin,
    // `space-y-2`, which positioned cards no longer inherit.
    gap: CARD_GAP,
  })

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {t('wfActivity:table.loading')}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icons.Activity />
          </EmptyMedia>
          <EmptyTitle>{t('wfActivity:table.no_activities')}</EmptyTitle>
          <EmptyDescription>
            {filtersActive
              ? t('wfActivity:table.no_activities_filtered')
              : t('wfActivity:table.no_activities_desc')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {filtersActive ? (
            onClearFilters ? (
              <Button variant="outline" onClick={onClearFilters}>
                {t('wfActivity:table.clear_filters')}
              </Button>
            ) : null
          ) : onAdd ? (
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button onClick={onAdd}>
                <Icons.Plus className="me-2 h-4 w-4" aria-hidden="true" />
                {t('wfActivity:add_activity')}
              </Button>
              {showConnectAccountLink && (
                <Link
                  to={connectPagePath('activities_empty')}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  <Icons.CloudSync2
                    className="me-2 h-4 w-4"
                    aria-hidden="true"
                  />
                  {t('wfActivity:page.connect_account')}
                </Link>
              )}
            </div>
          ) : null}
        </EmptyContent>
      </Empty>
    )
  }

  /**
   * One card. Extracted from the list body so the virtualizer can render it
   * inside the positioned wrapper it needs for each row.
   */
  const renderCard = (activity: ActivityDetails) => {
    const symbol = activity.assetSymbol
    const activityType = activity.activityType
    const isTransferActivity =
      activityType === ActivityType.TRANSFER_IN ||
      activityType === ActivityType.TRANSFER_OUT
    const isAssetBackedIncome = isAssetBackedIncomeActivity(
      activityType,
      symbol,
      activity.assetId,
    )
    const isCash = isTransferActivity
      ? isCashTransfer(activityType, symbol, activity.assetId)
      : isCashActivity(activityType) && !isAssetBackedIncome
    const hasAsset = Boolean(activity.assetId?.trim())
    const isOptionActivity = activity.instrumentType === 'OPTION'
    const parsedOption = isOptionActivity ? parseOccSymbol(symbol) : null
    const displaySymbol = isCash
      ? t('wfActivity:table.cash')
      : parsedOption
        ? parsedOption.underlying
        : symbol
    const avatarSymbol = isCash ? '$CASH' : symbol
    const optionSubtitle = parsedOption
      ? formatOptionSubtitle(
          parsedOption,
          activity.assetQuoteCcy ?? activity.currency,
          {
            ...amountFormatting,
            ...dateFormatting,
          },
        )
      : null
    const formattedDate = formatDateTime(
      activity.date,
      dateFormatting,
      appTimezone,
    )
    // Under a day heading a card gives only the time; the heading has the date.
    const headedTime = groupByDay
      ? formatDateTime(activity.date, dateFormatting, appTimezone, {
          omitSeconds: true,
        }).time
      : null
    const displayValue = calculateActivityValue(activity)
    // The balance after this row; an end-of-day balance goes in its day's
    // heading instead.
    const cashBalance =
      activity.cashBalance != null &&
      activity.cashBalanceCurrency &&
      activity.cashBalanceScope !== 'DAY'
        ? {
            balance: activity.cashBalance,
            currency: activity.cashBalanceCurrency,
          }
        : undefined

    // Compact View
    if (isCompactView) {
      const activityTypeLabel = localizeActivityRowLabel(t, activity)
      return (
        <Card
          key={activity.id}
          className={cn(
            'p-3',
            activity.needsReview && [
              'relative overflow-hidden',
              NEEDS_REVIEW_CARD_CLASS,
            ],
          )}
        >
          {activity.needsReview && <NeedsReviewStripe />}
          <div className="flex items-center gap-3">
            {(() => {
              const inner = (
                <>
                  <TickerAvatar
                    symbol={avatarSymbol}
                    exchangeMic={activity.exchangeMic}
                    instrumentType={activity.instrumentType}
                    assetId={activity.assetId}
                    className="h-10 w-10 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1.5 font-semibold">
                        {activity.needsReview && (
                          <NeedsReviewMark
                            label={t('wfActivity:detail.needs_review')}
                          />
                        )}
                        <span className="truncate">{displaySymbol}</span>
                      </p>
                      {activity.activityType !== 'SPLIT' &&
                        !isConversionRow(activity) && (
                          <AmountDisplay
                            value={displayValue}
                            currency={activity.currency}
                            isHidden={isBalanceHidden}
                            className="shrink-0 text-sm font-semibold"
                          />
                        )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {optionSubtitle
                        ? `${activityTypeLabel} · ${optionSubtitle}`
                        : activityTypeLabel}
                    </p>
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                      <span>{headedTime ?? formattedDate.date}</span>
                      {!isCash &&
                        !(
                          isIncomeActivity(activity.activityType) &&
                          !isAssetBackedIncome
                        ) &&
                        !isSplitActivity(activity.activityType) &&
                        !isFeeActivity(activity.activityType) &&
                        activity.quantity && (
                          <>
                            <span>•</span>
                            <span>
                              {isBalanceHidden
                                ? '••••'
                                : amountFormatting.formatDecimal(
                                    activity.quantity,
                                  )}{' '}
                              {isOptionActivity
                                ? t('wfActivity:date_list.contracts')
                                : t('wfActivity:date_list.shares')}
                            </span>
                          </>
                        )}
                      {cashBalance && (
                        <span className="ms-auto flex shrink-0 items-center gap-1">
                          {t('wfActivity:table_balance')}
                          <AmountDisplay
                            value={cashBalance.balance}
                            currency={cashBalance.currency}
                            isHidden={isBalanceHidden}
                          />
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )
              return isCash || !hasAsset ? (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {inner}
                </div>
              ) : (
                <Link
                  to={`/holdings/${encodeURIComponent(activity.assetId)}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {inner}
                </Link>
              )
            })()}
            <ActivityOperations
              activity={activity}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={onDuplicate}
              onLinkTransfer={onLinkTransfer}
              onUnlinkTransfer={onUnlinkTransfer}
              touch
            />
          </div>
        </Card>
      )
    }

    // Detailed View
    return (
      <Card
        key={activity.id}
        className={cn(
          'p-3',
          activity.needsReview && [
            'relative overflow-hidden',
            NEEDS_REVIEW_CARD_CLASS,
          ],
        )}
      >
        {activity.needsReview && <NeedsReviewStripe />}
        <div className="space-y-2">
          {/* Header: Symbol and Date */}
          <div className="flex items-start justify-between">
            {(() => {
              const inner = (
                <>
                  <TickerAvatar
                    symbol={avatarSymbol}
                    exchangeMic={activity.exchangeMic}
                    instrumentType={activity.instrumentType}
                    assetId={activity.assetId}
                    className="h-10 w-10"
                  />
                  <div>
                    <p className="flex items-center gap-1.5 font-semibold">
                      {activity.needsReview && (
                        <NeedsReviewMark
                          label={t('wfActivity:detail.needs_review')}
                        />
                      )}
                      {displaySymbol}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {isCash
                        ? activity.currency
                        : (optionSubtitle ?? activity.assetName)}
                    </p>
                  </div>
                </>
              )
              return isCash || !hasAsset ? (
                <div className="flex items-center gap-2">{inner}</div>
              ) : (
                <Link
                  to={`/holdings/${encodeURIComponent(activity.assetId)}`}
                  className="flex items-center gap-2"
                >
                  {inner}
                </Link>
              )
            })()}
            <ActivityOperations
              activity={activity}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={onDuplicate}
              onLinkTransfer={onLinkTransfer}
              onUnlinkTransfer={onUnlinkTransfer}
              touch
            />
          </div>

          <Separator />

          {/* Activity Details Grid */}
          <div className="space-y-1.5 text-sm">
            {/* Date and Type */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t('wfActivity:table_date')}
              </span>
              {headedTime ? (
                <p className="text-end">{headedTime}</p>
              ) : (
                <div className="text-end">
                  <p>{formattedDate.date}</p>
                  <p className="text-muted-foreground text-xs">
                    {formattedDate.time}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t('wfActivity:table_type')}
              </span>
              <ActivityTypeBadge
                type={activity.activityType}
                subtype={activity.subtype}
                className="text-xs font-normal"
              />
            </div>

            {/* Quantity (if applicable) */}
            {!isCash &&
              !(
                isIncomeActivity(activity.activityType) && !isAssetBackedIncome
              ) &&
              !isSplitActivity(activity.activityType) &&
              !isFeeActivity(activity.activityType) &&
              activity.quantity && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {isOptionActivity
                      ? t('wfActivity:detail.contracts')
                      : t('wfActivity:field_shares')}
                  </span>
                  <span className="font-medium">
                    {isBalanceHidden
                      ? '••••'
                      : amountFormatting.formatDecimal(activity.quantity)}
                  </span>
                </div>
              )}

            {/* Price/Amount */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {activity.activityType === 'SPLIT'
                  ? t('wfActivity:table.ratio')
                  : (isCashActivity(activity.activityType) &&
                        !isAssetBackedIncome &&
                        !isSecuritiesTransfer(
                          activity.activityType,
                          symbol,
                          activity.assetId,
                        )) ||
                      isCashTransfer(
                        activity.activityType,
                        symbol,
                        activity.assetId,
                      ) ||
                      (isIncomeActivity(activity.activityType) &&
                        !isAssetBackedIncome)
                    ? t('wfActivity:form.label_amount')
                    : isOptionActivity
                      ? t('wfActivity:table.premium')
                      : t('wfActivity:field_price')}
              </span>
              <span className="font-medium">
                {activity.activityType === 'FEE' ||
                isConversionRow(activity) ? (
                  '-'
                ) : activity.activityType === 'SPLIT' ? (
                  formatSplitRatio(activity.amount)
                ) : (isCashActivity(activity.activityType) &&
                    !isAssetBackedIncome &&
                    !isSecuritiesTransfer(
                      activity.activityType,
                      symbol,
                      activity.assetId,
                    )) ||
                  isCashTransfer(
                    activity.activityType,
                    symbol,
                    activity.assetId,
                  ) ||
                  (isIncomeActivity(activity.activityType) &&
                    !isAssetBackedIncome) ? (
                  <AmountDisplay
                    value={activity.amount}
                    currency={activity.currency}
                    isHidden={isBalanceHidden}
                  />
                ) : (
                  <PriceDisplay
                    value={activity.unitPrice}
                    currency={activity.currency}
                    isHidden={isBalanceHidden}
                  />
                )}
              </span>
            </div>

            {/* Fee (if applicable) */}
            {decimalUnits(activity.fee) > 0n &&
              activity.activityType !== 'SPLIT' && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t('wfActivity:table_fee')}
                  </span>
                  <AmountDisplay
                    value={activity.fee}
                    currency={activity.currency}
                    isHidden={isBalanceHidden}
                    className="font-medium"
                  />
                </div>
              )}
            {decimalUnits(activity.tax) > 0n &&
              activity.activityType !== 'SPLIT' && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t('wfActivity:table.tax')}
                  </span>
                  <AmountDisplay
                    value={activity.tax}
                    currency={activity.currency}
                    isHidden={isBalanceHidden}
                    className="font-medium"
                  />
                </div>
              )}

            {/* Total Value */}
            {activity.activityType !== 'SPLIT' &&
              !isConversionRow(activity) && (
                <div className="flex items-center justify-between border-t pt-1.5">
                  <span className="text-muted-foreground font-medium">
                    {t('wfActivity:table.total_value')}
                  </span>
                  <AmountDisplay
                    value={displayValue}
                    currency={activity.currency}
                    isHidden={isBalanceHidden}
                    className="font-semibold"
                  />
                </div>
              )}

            {cashBalance && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t('wfActivity:table_balance')}
                </span>
                <AmountDisplay
                  value={cashBalance.balance}
                  currency={cashBalance.currency}
                  isHidden={isBalanceHidden}
                  className="font-medium"
                />
              </div>
            )}

            {/* Account */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t('wfActivity:table_account')}
              </span>
              <div className="text-end">
                <p>{activity.accountName}</p>
                <p className="text-muted-foreground text-xs">
                  {activity.accountCurrency}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div
      data-virtual-scroll-parent
      className="min-h-0 flex-1 overflow-auto"
      /* `overflow-anchor: none` keeps the browser from choosing a card in here
         as its scroll anchor: cards are recycled as you scroll, and
         re-anchoring to one that just changed height fights the virtualizer. */
      style={{ overflowAnchor: 'none' }}
    >
      <div
        ref={listRef}
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const listItem = listItems[virtualItem.index]
          if (!listItem) return null
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute start-0 top-0 w-full"
              style={{
                transform: `translateY(${virtualItem.start - scrollMargin}px)`,
              }}
            >
              {listItem.kind === 'header' ? (
                <ActivityDayHeading
                  group={listItem.group}
                  date={listItem.group.items[0].date}
                  isPartial={hasNextPage && listItem.isLastGroup}
                />
              ) : (
                renderCard(listItem.item)
              )}
            </div>
          )
        })}
      </div>
      {onLoadMore && (
        <InfiniteScrollTrigger
          onLoadMore={onLoadMore}
          hasNextPage={hasNextPage}
          isFetching={isFetching ?? isFetchingNextPage}
          isFetchingNextPage={isFetchingNextPage}
          hasLoadMoreError={hasLoadMoreError}
        />
      )}
    </div>
  )
}

export default ActivityTableMobile
