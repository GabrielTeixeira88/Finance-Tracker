// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 holdings-table.tsx. Exact API fields and local navigation replace financial/platform seams; original presentation retained.
import { profilePreferenceKey } from './compat'
import { usesLegacyPreferences } from './compat'
import { formatOptionSubtitle, parseOccSymbol } from './compat'
import type { ColumnDef, SortingFn } from '@tanstack/react-table'
import {
  Badge,
  GainPercent,
  useAmountFormatting,
  useNumberFormatting,
  type FormattingApi,
  useDateFormatting,
} from './ui'
import { Button } from '@/vendor/wealthfolio/ui/components/ui/button'
import { DataTable } from '@/vendor/wealthfolio/ui/components/ui/data-table'
import { DataTableColumnHeader } from '@/vendor/wealthfolio/ui/components/ui/data-table/data-table-column-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/vendor/wealthfolio/ui/components/ui/dropdown-menu'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'

import { TickerAvatar } from './formatting'
import { HoldingPerformancePercent } from './formatting'
import {
  HOLDINGS_TABLE_DENSITY,
  PERCENT_BADGE,
  ROW_ACTIONS_TRIGGER,
} from './holdings-table-styles'
import { useBalancePrivacy } from './compat'
import { HoldingType } from './compat'
import { getBaseHoldingPerformancePercent } from './compat'
import type { Holding, MonetaryValue } from './types'
import { AmountDisplay, PriceDisplay, QuantityDisplay } from './ui'
import { Skeleton } from '@/vendor/wealthfolio/ui/components/ui/skeleton'
import type { TFunction } from 'i18next'
import { exactSubtract, exactAdd, compareExact } from './compat'
import { formatExactPercent } from '@/lib/money'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, type NavigateFunction } from './compat'
import { HoldingsStatusSegmentedControl } from './holdings-status-control'
import { isCashHolding, isClosedPosition } from './holdings-visibility'
import type { HoldingsVisibilityFilter } from './holdings-visibility'
import {
  getHoldingTypeFilterOption,
  getHoldingTypeFilterValue,
  getHoldingTypeTranslationKey,
} from './holdings-type-filter'

const monetaryColumns = new Set([
  'closedCostBasis',
  'saleProceeds',
  'closedRealizedPnl',
  'marketPrice',
  'avgPrice',
  'bookValue',
  'marketValue',
  'totalPnl',
  'totalReturn',
  'dayPnl',
  'unrealizedPnl',
  'realizedPnl',
  'income',
])
const exactMonetarySort: SortingFn<Holding> = (left, right, id) =>
  left.original.localCurrency.localeCompare(right.original.localCurrency) ||
  compareExact(
    left.getValue<string | null>(id),
    right.getValue<string | null>(id),
  )

// Exact API fields replace the original Number-money calculations and zero fallbacks.
const getDisplayValueAndCurrency = (
  holding: Holding,
  value: string | null,
  _converted: boolean,
) => {
  void _converted
  return { value, currency: holding.localCurrency }
}
const getAveragePrice = (holding: Holding) => holding.averagePrice
const getDisposedCostBasis = (holding: Holding): MonetaryValue | null =>
  holding.returnBasis.local == null || holding.costBasis.local == null
    ? null
    : {
        local: exactSubtract(
          holding.returnBasis.local,
          holding.costBasis.local,
        ),
        base: exactSubtract(holding.returnBasis.base, holding.costBasis.base),
      }
const getClosingCashFlow = (holding: Holding): MonetaryValue | null => {
  const basis = getDisposedCostBasis(holding)
  return basis == null
    ? null
    : {
        local: exactAdd(basis.local, holding.realizedGain.local),
        base: exactAdd(basis.base, holding.realizedGain.base),
      }
}

const CLOSED_POSITION_COLUMN_IDS = new Set([
  'symbol',
  'closedCostBasis',
  'saleProceeds',
  'closedRealizedPnl',
  'realizedReturn',
  'symbolName',
  'accountNames',
  'holdingType',
  'currency',
  'actions',
])

const CLOSED_ONLY_COLUMN_IDS = new Set([
  'closedCostBasis',
  'saleProceeds',
  'closedRealizedPnl',
  'realizedReturn',
])

export const HoldingsTable = ({
  holdings,
  isLoading,
  onClassify,
  visibilityFilters,
  setVisibilityFilters,
  showClosedPositions = true,
}: {
  holdings: Holding[]
  isLoading: boolean
  onClassify?: (holding: Holding) => void
  visibilityFilters?: HoldingsVisibilityFilter[]
  setVisibilityFilters?: (value: HoldingsVisibilityFilter[]) => void
  showClosedPositions?: boolean
}) => {
  const { t, i18n } = useTranslation()
  const formatting = useNumberFormatting()
  const amountFormatting = useAmountFormatting()
  const dateFormatting = useDateFormatting()
  const navigate = useNavigate()
  const { isBalanceHidden } = useBalancePrivacy()
  const showConvertedValues = false
  const isClosedView =
    visibilityFilters?.length === 1 && visibilityFilters[0] === 'closed'

  // DataTable renders each `cell` as a component, so a new column array remounts every cell.
  const columns = useMemo(
    () =>
      getColumns(
        t,
        isBalanceHidden,
        showConvertedValues,
        formatting,
        amountFormatting,
        dateFormatting,
        navigate,
        onClassify,
      )
        .map((column) =>
          monetaryColumns.has(column.id ?? '')
            ? { ...column, sortingFn: exactMonetarySort }
            : column,
        )
        .filter((column) => {
          if (!('id' in column) || column.id == null) return false
          return isClosedView
            ? CLOSED_POSITION_COLUMN_IDS.has(column.id)
            : !CLOSED_ONLY_COLUMN_IDS.has(column.id)
        }),
    [
      t,
      isBalanceHidden,
      showConvertedValues,
      formatting,
      amountFormatting,
      dateFormatting,
      navigate,
      onClassify,
      isClosedView,
    ],
  )

  if (isLoading) {
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  const uniqueTypesSet = new Set()
  const assetsTypes: { label: string; value: string }[] = holdings.reduce(
    (result: { label: string; value: string }[], holding) => {
      const option = getHoldingTypeFilterOption(holding, t('wfHoldings:cash'))
      if (option && !uniqueTypesSet.has(option.value)) {
        uniqueTypesSet.add(option.value)
        result.push({
          label: t(getHoldingTypeTranslationKey(option.value), {
            defaultValue: option.fallbackLabel,
          }).toLocaleUpperCase(i18n.resolvedLanguage),
          value: option.value,
        })
      }
      return result
    },
    [],
  )

  const filters = [
    {
      id: 'holdingType',
      title: t('wfHoldings:type'),
      options: assetsTypes,
    },
  ]

  return (
    <div className={`flex h-full flex-col ${HOLDINGS_TABLE_DENSITY}`}>
      <DataTable
        data={holdings}
        columns={columns}
        searchBy="symbol"
        filters={filters}
        showColumnToggle={true}
        storageKey={profilePreferenceKey('holdings-table-v4')}
        fallbackStorageKey={
          usesLegacyPreferences() ? 'holdings-table-v4' : undefined
        }
        defaultColumnVisibility={
          isClosedView
            ? {
                currency: false,
                holdingType: false,
                symbolName: false,
                accountNames: false,
              }
            : {
                currency: false,
                symbolName: false,
                accountNames: false,
                holdingType: false,
                avgPrice: false,
                weight: false,
                bookValue: false,
                totalPnl: false,
                unrealizedPnl: false,
                realizedPnl: false,
                income: false,
                dayPnl: false,
              }
        }
        defaultSorting={[{ id: 'symbol', desc: false }]}
        scrollable={true}
        toolbarView={
          visibilityFilters && setVisibilityFilters ? (
            <HoldingsStatusSegmentedControl
              value={visibilityFilters}
              onChange={setVisibilityFilters}
              showClosedPositions={showClosedPositions}
            />
          ) : undefined
        }
      />
    </div>
  )
}

export default HoldingsTable

const getColumns = (
  t: TFunction,
  isHidden: boolean,
  showConvertedValues: boolean,
  formatting: Pick<FormattingApi, 'formatPercent'>,
  amountFormatting: Pick<FormattingApi, 'formatPrice'>,
  dateFormatting: Pick<FormattingApi, 'formatCalendarDate'>,
  navigate: NavigateFunction,
  onClassify?: (holding: Holding) => void,
): ColumnDef<Holding>[] => [
  {
    id: 'symbol',
    accessorKey: 'instrument.symbol',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('wfHoldings:position')} />
    ),
    meta: {
      label: t('wfHoldings:position'),
    },
    cell: ({ row }) => {
      const holding = row.original
      const symbol = holding.instrument?.symbol ?? holding.id
      const isCash = holding.holdingType === HoldingType.CASH
      const isClosed = isClosedPosition(holding)

      // Parse OCC symbol for options
      const parsedOption = isCash ? null : parseOccSymbol(symbol)
      const displaySymbol = isCash
        ? t('wfHoldings:cash')
        : parsedOption
          ? parsedOption.underlying
          : symbol
      const avatarSymbol = isCash
        ? `CASH:${holding.localCurrency}`
        : parsedOption
          ? parsedOption.underlying
          : symbol

      // Option subtitle: "Mar 29 $150.00 CALL"
      const optionSubtitle = parsedOption
        ? formatOptionSubtitle(
            parsedOption,
            holding.instrument?.currency ?? holding.localCurrency,
            { ...amountFormatting, ...dateFormatting },
          )
        : null

      const handleNavigate = () => {
        // Use instrument.id (asset ID) for navigation, not symbol (which may be stripped)
        const navSymbol = holding.instrument?.id ?? holding.id
        navigate(`/holdings/${encodeURIComponent(navSymbol)}`, {
          state: { holding },
        })
      }

      const isManual = holding.instrument?.quoteMode === 'MANUAL'
      const content = (
        <div className="flex items-center">
          <TickerAvatar
            symbol={avatarSymbol}
            exchangeMic={holding.instrument?.exchangeMic}
            instrumentType={holding.instrument?.instrumentType}
            assetId={holding.instrument?.id}
            className="me-2 h-8 w-8"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <bdi className="font-semibold">{displaySymbol}</bdi>
              {isManual && !isCash && (
                <Badge variant="secondary" className="text-2xs h-4 px-1 py-0">
                  {t('wfHoldings:manual')}
                </Badge>
              )}
              {isClosed && (
                <Badge variant="outline" className="text-2xs h-4 px-1 py-0">
                  {t('wfHoldings:closed')}
                </Badge>
              )}
            </div>
            {/* Provider names read in their own direction: "Apple Inc." keeps its period
                at the end and a clipped name its start; RTL pages keep it on the right. */}
            <span
              dir="auto"
              className="text-muted-foreground line-clamp-1 text-xs rtl:text-right"
            >
              {optionSubtitle ??
                (isCash
                  ? t('wfHoldings:cash_balance')
                  : holding.instrument?.name) ??
                null}
            </span>
          </div>
        </div>
      )

      return (
        <div
          className={isCash ? '-m-1 p-1' : '-m-1 cursor-pointer p-1'}
          role={isCash ? undefined : 'button'}
          tabIndex={isCash ? undefined : 0}
          onKeyDown={
            isCash
              ? undefined
              : (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleNavigate()
                  }
                }
          }
          onClick={isCash ? undefined : handleNavigate}
        >
          {content}
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const symbolA = rowA.original.instrument?.symbol ?? rowA.original.id
      const symbolB = rowB.original.instrument?.symbol ?? rowB.original.id
      return symbolA.localeCompare(symbolB)
    },
    filterFn: (row, _columnId, filterValue) => {
      const holding = row.original
      const searchTerm = filterValue as string
      const lowerSearch = searchTerm.toLowerCase()
      const nameMatch = holding.instrument?.name
        ?.toLowerCase()
        .includes(lowerSearch)
      const symbolMatch = holding.instrument?.symbol
        ?.toLowerCase()
        .includes(lowerSearch)
      const idMatch = holding.id.toLowerCase().includes(lowerSearch)
      // Also match on the underlying symbol for options
      const parsed = parseOccSymbol(holding.instrument?.symbol ?? '')
      const underlyingMatch = parsed?.underlying
        .toLowerCase()
        .includes(lowerSearch)
      return !!(symbolMatch || nameMatch || idMatch || underlyingMatch)
    },
    enableHiding: false,
  },
  {
    id: 'closedCostBasis',
    accessorFn: (row) => getDisposedCostBasis(row)?.base ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end text-end"
        column={column}
        title={t('wfHoldings:cost_basis')}
      />
    ),
    meta: {
      label: t('wfHoldings:cost_basis'),
    },
    cell: ({ row }) => {
      const holding = row.original
      const costBasis = getDisposedCostBasis(holding)
      if (costBasis == null) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }

      const value = showConvertedValues ? costBasis.base : costBasis.local
      const currency = showConvertedValues
        ? holding.baseCurrency
        : holding.localCurrency
      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            isHidden={isHidden}
          />
          <div className="text-muted-foreground text-xs">{currency}</div>
        </div>
      )
    },
    sortingFn: (rowA, rowB) =>
      compareExact(
        getDisposedCostBasis(rowA.original)?.base ?? null,
        getDisposedCostBasis(rowB.original)?.base ?? null,
      ),
  },
  {
    id: 'saleProceeds',
    accessorFn: (row) => getClosingCashFlow(row)?.base ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end text-end"
        column={column}
        title={t('wfHoldings:closing_cash_flow')}
      />
    ),
    meta: {
      label: t('wfHoldings:closing_cash_flow'),
    },
    cell: ({ row }) => {
      const holding = row.original
      const cashFlow = getClosingCashFlow(holding)
      if (cashFlow == null) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }

      const value = showConvertedValues ? cashFlow.base : cashFlow.local
      const currency = showConvertedValues
        ? holding.baseCurrency
        : holding.localCurrency
      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            isHidden={isHidden}
          />
          <div className="text-muted-foreground text-xs">{currency}</div>
        </div>
      )
    },
    sortingFn: (rowA, rowB) =>
      compareExact(
        getClosingCashFlow(rowA.original)?.base ?? null,
        getClosingCashFlow(rowB.original)?.base ?? null,
      ),
  },
  {
    id: 'closedRealizedPnl',
    accessorFn: (row) => row.realizedGain?.base ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end text-end"
        column={column}
        title={t('wfHoldings:realized_pnl')}
      />
    ),
    meta: {
      label: t('wfHoldings:realized_pnl'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (holding.realizedGain == null) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }

      const value = showConvertedValues
        ? holding.realizedGain.base
        : holding.realizedGain.local
      const currency = showConvertedValues
        ? holding.baseCurrency
        : holding.localCurrency
      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            colorFormat={true}
            isHidden={isHidden}
          />
          <div className="text-muted-foreground text-xs">{currency}</div>
        </div>
      )
    },
    sortingFn: (rowA, rowB) =>
      compareExact(
        rowA.original.realizedGain?.base ?? null,
        rowB.original.realizedGain?.base ?? null,
      ),
  },
  {
    id: 'realizedReturn',
    accessorFn: (row) => row.realizedGainPct ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end text-end"
        column={column}
        title={t('wfHoldings:realized_return')}
      />
    ),
    meta: {
      label: t('wfHoldings:realized_return'),
    },
    cell: ({ row }) => {
      const holding = row.original
      const percentage = showConvertedValues
        ? getBaseHoldingPerformancePercent(holding, 'realizedGain')
        : holding.realizedGainPct

      return (
        <div className="flex min-h-10 items-center justify-end px-4">
          {percentage == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <HoldingPerformancePercent
              variant="badge"
              className={PERCENT_BADGE}
              value={percentage}
            />
          )}
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const percentageA = showConvertedValues
        ? getBaseHoldingPerformancePercent(rowA.original, 'realizedGain')
        : rowA.original.realizedGainPct
      const percentageB = showConvertedValues
        ? getBaseHoldingPerformancePercent(rowB.original, 'realizedGain')
        : rowB.original.realizedGainPct
      return compareExact(percentageA, percentageB)
    },
  },
  {
    id: 'symbolName',
    accessorFn: (row) => row.instrument?.name || row.id,
    meta: {
      label: t('wfHoldings:symbol_name'),
    },
    enableHiding: false,
  },
  {
    id: 'accountNames',
    accessorFn: (row) => row.accountNames.join(', '),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('wfHoldings:account')} />
    ),
    meta: { label: t('wfHoldings:account') },
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {row.original.accountNames.join(', ')}
      </span>
    ),
  },
  {
    id: 'quantity',
    accessorKey: 'quantity',
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end text-end"
        column={column}
        title={t('wfHoldings:qty')}
      />
    ),
    meta: {
      label: t('wfCommon:quantity'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isCashHolding(holding)) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }

      const symbol = holding.instrument?.symbol ?? holding.id
      const isOption = !!parseOccSymbol(symbol)
      const assetTypeKey =
        holding.instrument?.classifications?.assetType?.key ?? ''
      const isBond =
        assetTypeKey.startsWith('BOND_') ||
        assetTypeKey === 'DEBT_SECURITY' ||
        assetTypeKey === 'MONEY_MARKET_DEBT'
      const isEtfOrFund =
        assetTypeKey === 'ETF' || assetTypeKey === 'FUND_MUTUAL'
      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <QuantityDisplay value={holding.quantity} isHidden={isHidden} />
          <span className="text-muted-foreground text-xs">
            {holding.contract &&
            holding.contract.instrument_type !== 'TESOURO_SELIC'
              ? t('holdingsMigration:principalUnits', {
                  currency: holding.localCurrency,
                })
              : isOption
                ? t('wfHoldings:contracts')
                : isBond
                  ? t('wfHoldings:bonds')
                  : isEtfOrFund
                    ? t('wfHoldings:units')
                    : t('wfHoldings:shares_label')}
          </span>
        </div>
      )
    },
    sortingFn: (rowA, rowB) =>
      compareExact(rowA.original.quantity, rowB.original.quantity),
  },
  {
    id: 'marketPrice',
    accessorFn: (row) => row.price ?? null,
    enableHiding: true,
    enableSorting: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end text-end"
        column={column}
        title={t('wfHoldings:todays_price')}
      />
    ),
    meta: {
      label: t('wfHoldings:todays_price'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isCashHolding(holding) || isClosedPosition(holding)) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }
      const price = holding.price ?? null
      const currency = holding.localCurrency
      if (
        holding.contract &&
        holding.contract.instrument_type !== 'TESOURO_SELIC'
      ) {
        const fixed = holding.contract.instrument_type === 'CDB_FIXED'
        return (
          <div className="flex min-h-10 flex-col items-end justify-center px-4">
            <span className="tabular-nums">
              {formatExactPercent(
                fixed
                  ? holding.contract.annual_rate
                  : holding.contract.cdi_percent,
                2,
                true,
              )}{' '}
              {fixed ? t('holdingsMigration:annualRate') : 'CDI'}
            </span>
            <span className="text-muted-foreground text-xs">
              {t('holdingsMigration:contractValue')}
            </span>
          </div>
        )
      }
      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <PriceDisplay value={price} currency={currency} />
          <GainPercent
            variant="badge"
            className={PERCENT_BADGE}
            value={holding.dayChangePct ?? null}
          />
        </div>
      )
    },
  },
  {
    id: 'avgPrice',
    accessorFn: (row) => getAveragePrice(row) ?? null,
    enableHiding: true,
    enableSorting: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end text-end"
        column={column}
        title={t('wfHoldings:avg_price')}
      />
    ),
    meta: {
      label: t('wfHoldings:avg_price'),
    },
    cell: ({ row }) => {
      const averagePrice = getAveragePrice(row.original)

      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          {averagePrice == null ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <PriceDisplay
              value={averagePrice}
              currency={row.original.localCurrency}
              isHidden={isHidden}
            />
          )}
          <div className="text-xs text-transparent">-</div>
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const valueA = getAveragePrice(rowA.original) ?? null
      const valueB = getAveragePrice(rowB.original) ?? null
      return compareExact(valueA, valueB)
    },
  },
  {
    id: 'bookValue',
    accessorFn: (row) => row.costBasis?.local ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end"
        column={column}
        title={t('wfHoldings:book_cost')}
      />
    ),
    meta: {
      label: t('wfHoldings:book_cost'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isCashHolding(holding) || isClosedPosition(holding)) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }
      const value = holding.costBasis?.local ?? null
      const currency = holding.localCurrency

      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            isHidden={isHidden}
          />
          <div className="text-xs text-transparent">-</div>
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const valueA = rowA.original.costBasis?.local ?? null
      const valueB = rowB.original.costBasis?.local ?? null
      return compareExact(valueA, valueB)
    },
  },
  {
    id: 'marketValue',
    accessorFn: (row) => row.marketValue.base ?? null,
    enableHiding: false,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end"
        column={column}
        title={t('wfHoldings:total_value')}
      />
    ),
    meta: {
      label: t('wfHoldings:total_value'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isClosedPosition(holding)) {
        return (
          <div className="flex min-h-10 flex-col items-end justify-center px-4">
            <span className="text-muted-foreground">—</span>
            <span className="text-muted-foreground text-xs">
              {t('wfHoldings:closed')}
            </span>
          </div>
        )
      }
      const { value, currency } = getDisplayValueAndCurrency(
        holding,
        holding.marketValue.base,
        showConvertedValues,
      )

      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            isHidden={isHidden}
          />
          <div className="text-muted-foreground text-xs">{currency}</div>
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const holdingA = rowA.original
      const holdingB = rowB.original

      // Always sort by base currency value for consistency
      const valueA = holdingA.marketValue.base ?? null
      const valueB = holdingB.marketValue.base ?? null

      return compareExact(valueA, valueB)
    },
  },
  {
    id: 'weight',
    accessorFn: (row) => row.weight ?? null,
    enableHiding: true,
    enableSorting: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end text-end"
        column={column}
        title={t('wfHoldings:weight')}
      />
    ),
    meta: {
      label: t('wfHoldings:weight'),
    },
    cell: ({ row }) =>
      isClosedPosition(row.original) ? (
        <div className="text-muted-foreground px-4 text-end">—</div>
      ) : (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <span className="font-medium tabular-nums">
            {formatting.formatPercent(row.original.weight ?? null)}
          </span>
          <div className="text-xs text-transparent">-</div>
        </div>
      ),
    sortingFn: (rowA, rowB) =>
      compareExact(rowA.original.weight, rowB.original.weight),
  },
  {
    id: 'totalPnl',
    accessorFn: (row) => row.totalGain?.base ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end"
        column={column}
        title={t('wfHoldings:total_pnl')}
      />
    ),
    meta: {
      label: t('wfHoldings:total_pnl'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isCashHolding(holding)) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }
      const value = showConvertedValues
        ? (holding.totalGain?.base ?? null)
        : (holding.totalGain?.local ?? null)
      const currency = showConvertedValues
        ? holding.baseCurrency
        : holding.localCurrency
      const percentage = showConvertedValues
        ? getBaseHoldingPerformancePercent(holding, 'totalGain')
        : holding.totalGainPct

      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            colorFormat={true}
            isHidden={isHidden}
          />
          <HoldingPerformancePercent
            variant="badge"
            className={PERCENT_BADGE}
            value={percentage}
          />
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const holdingA = rowA.original
      const holdingB = rowB.original

      // Always sort by base currency value for consistency
      const valueA = holdingA.totalGain?.base ?? null
      const valueB = holdingB.totalGain?.base ?? null

      return compareExact(valueA, valueB)
    },
  },
  {
    id: 'totalReturn',
    accessorFn: (row) => row.totalReturn?.base ?? row.totalGain?.base ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end"
        column={column}
        title={t('wfHoldings:total_return')}
      />
    ),
    meta: {
      label: t('wfHoldings:total_return'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isCashHolding(holding)) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }
      const value = showConvertedValues
        ? (holding.totalReturn?.base ?? null)
        : (holding.totalReturn?.local ?? null)
      const currency = showConvertedValues
        ? holding.baseCurrency
        : holding.localCurrency
      const percentage = showConvertedValues
        ? getBaseHoldingPerformancePercent(holding, 'totalReturn')
        : holding.totalReturnPct

      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            colorFormat={true}
            isHidden={isHidden}
          />
          <HoldingPerformancePercent
            variant="badge"
            className={PERCENT_BADGE}
            value={percentage}
          />
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const valueA =
        rowA.original.totalReturn?.base ?? rowA.original.totalGain?.base ?? null
      const valueB =
        rowB.original.totalReturn?.base ?? rowB.original.totalGain?.base ?? null
      return compareExact(valueA, valueB)
    },
  },
  {
    id: 'dayPnl',
    accessorFn: (row) => row.dayChange?.base ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end"
        column={column}
        title={t('wfHoldings:day_pnl')}
      />
    ),
    meta: {
      label: t('wfHoldings:day_pnl'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isCashHolding(holding) || isClosedPosition(holding)) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }
      const value = showConvertedValues
        ? (holding.dayChange?.base ?? null)
        : (holding.dayChange?.local ?? null)
      const currency = showConvertedValues
        ? holding.baseCurrency
        : holding.localCurrency

      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            colorFormat={true}
            isHidden={isHidden}
          />
          <GainPercent
            variant="badge"
            className={PERCENT_BADGE}
            value={holding.dayChangePct ?? null}
          />
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const valueA = rowA.original.dayChange?.base ?? null
      const valueB = rowB.original.dayChange?.base ?? null
      return compareExact(valueA, valueB)
    },
  },
  {
    id: 'unrealizedPnl',
    accessorFn: (row) => row.unrealizedGain?.base ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end"
        column={column}
        title={t('wfHoldings:unrealized_pnl')}
      />
    ),
    meta: {
      label: t('wfHoldings:unrealized_pnl'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isCashHolding(holding) || isClosedPosition(holding)) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }
      const value = showConvertedValues
        ? (holding.unrealizedGain?.base ?? null)
        : (holding.unrealizedGain?.local ?? null)
      const currency = showConvertedValues
        ? holding.baseCurrency
        : holding.localCurrency
      const percentage = showConvertedValues
        ? getBaseHoldingPerformancePercent(holding, 'unrealizedGain')
        : holding.unrealizedGainPct

      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            colorFormat={true}
            isHidden={isHidden}
          />
          <HoldingPerformancePercent
            variant="badge"
            className={PERCENT_BADGE}
            value={percentage}
          />
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const valueA = rowA.original.unrealizedGain?.base ?? null
      const valueB = rowB.original.unrealizedGain?.base ?? null
      return compareExact(valueA, valueB)
    },
  },
  {
    id: 'realizedPnl',
    accessorFn: (row) => row.realizedGain?.base ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end"
        column={column}
        title={t('wfHoldings:realized_pnl')}
      />
    ),
    meta: {
      label: t('wfHoldings:realized_pnl'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isCashHolding(holding)) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }
      const value = showConvertedValues
        ? (holding.realizedGain?.base ?? null)
        : (holding.realizedGain?.local ?? null)
      const currency = showConvertedValues
        ? holding.baseCurrency
        : holding.localCurrency
      const percentage = showConvertedValues
        ? getBaseHoldingPerformancePercent(holding, 'realizedGain')
        : holding.realizedGainPct

      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            colorFormat={true}
            isHidden={isHidden}
          />
          <HoldingPerformancePercent
            variant="badge"
            className={PERCENT_BADGE}
            value={percentage}
          />
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const valueA = rowA.original.realizedGain?.base ?? null
      const valueB = rowB.original.realizedGain?.base ?? null
      return compareExact(valueA, valueB)
    },
  },
  {
    id: 'income',
    accessorFn: (row) => row.income?.base ?? null,
    enableHiding: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        className="justify-end"
        column={column}
        title={t('wfHoldings:income')}
      />
    ),
    meta: {
      label: t('wfHoldings:income'),
    },
    cell: ({ row }) => {
      const holding = row.original
      if (isCashHolding(holding)) {
        return <div className="text-muted-foreground px-4 text-end">—</div>
      }
      const value = showConvertedValues
        ? (holding.income?.base ?? null)
        : (holding.income?.local ?? null)
      const currency = showConvertedValues
        ? holding.baseCurrency
        : holding.localCurrency

      return (
        <div className="flex min-h-10 flex-col items-end justify-center px-4">
          <AmountDisplay
            value={value}
            currency={currency}
            colorFormat={true}
            isHidden={isHidden}
          />
          <div className="text-xs text-transparent">-</div>
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const valueA = rowA.original.income?.base ?? null
      const valueB = rowB.original.income?.base ?? null
      return compareExact(valueA, valueB)
    },
  },
  {
    id: 'holdingType',
    accessorFn: getHoldingTypeFilterValue,
    meta: {
      label: t('wfHoldings:asset_type'),
    },
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={t('wfHoldings:asset_type')}
      />
    ),
    cell: ({ row }) => {
      const option = getHoldingTypeFilterOption(
        row.original,
        t('wfHoldings:cash'),
      )
      if (!option) return null

      return t(getHoldingTypeTranslationKey(option.value), {
        defaultValue: option.fallbackLabel,
      })
    },
    filterFn: (row, id, value: string[]) => {
      const holdingType = row.getValue<string | undefined>(id)
      return holdingType != null && value.includes(holdingType)
    },
  },
  {
    id: 'currency',
    accessorKey: 'localCurrency',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('wfHoldings:currency')} />
    ),
    meta: {
      label: t('wfHoldings:currency'),
    },
    cell: ({ row }) => (
      <div className="text-muted-foreground">{row.original.localCurrency}</div>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    header: () => null,
    cell: ({ row }) => {
      const holding = row.original
      const hasInstrument =
        holding.holdingType !== HoldingType.CASH && !!holding.instrument

      if (!hasInstrument) return null

      const handleNavigate = () => {
        // Use instrument.id (asset ID) for navigation, not symbol (which may be stripped)
        const navSymbol = holding.instrument?.id ?? holding.id
        navigate(`/holdings/${encodeURIComponent(navSymbol)}`, {
          state: { holding },
        })
      }

      return (
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('wfCommon:actions_for', {
                    name: holding.instrument?.symbol ?? '',
                  })}
                  className={ROW_ACTIONS_TRIGGER}
                />
              }
            >
              <Icons.MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onClassify && (
                <DropdownMenuItem onClick={() => onClassify(holding)}>
                  <Icons.Tag className="me-2 h-4 w-4" />
                  {t('wfHoldings:classify')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleNavigate}>
                <Icons.ChevronRight className="me-2 h-4 w-4 rtl:rotate-180" />
                {t('wfHoldings:view_details')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]
