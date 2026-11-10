import { compareExact } from './compat'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted source: Wealthfolio 92b4647 pages/holdings/components/holdings-table-mobile.tsx; see THIRD_PARTY_NOTICES.md.
import { TickerAvatar } from './formatting'
import { useBalancePrivacy } from './compat'
import { HoldingType } from './compat'
import { formatOptionSubtitle, parseOccSymbol } from './compat'
import type { Account, AccountScope, Holding } from './types'
import { cn } from '@/lib/utils'
import {
  AmountDisplay,
  Badge,
  GainPercent,
  Input,
  Separator,
  useAmountFormatting,
  useDateFormatting,
  useNumberFormatting,
} from './ui'
import { Button } from '@/vendor/wealthfolio/ui/components/ui/button'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import { Skeleton } from '@/vendor/wealthfolio/ui/components/ui/skeleton'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from './compat'
import { HoldingsMobileFilterSheet } from './holdings-mobile-filter-sheet'
import {
  compareCashFirst,
  DEFAULT_HOLDINGS_VISIBILITY,
  hasNonDefaultHoldingsVisibility,
  isClosedPosition,
  type HoldingsVisibilityFilter,
} from './holdings-visibility'
import { filterHoldingsByType } from './holdings-type-filter'

type PerformanceMode = 'daily' | 'pnl' | 'return'

interface HoldingsTableMobileProps {
  holdings: Holding[]
  isLoading: boolean
  selectedTypes: string[]
  setSelectedTypes: (types: string[]) => void
  accountFilter: AccountScope
  onAccountScopeChange: (filter: AccountScope) => void
  accounts: Account[]
  portfolios: { id: string; name: string }[]
  showAccountScope?: boolean
  showSearch?: boolean
  showFilterButton?: boolean
  sortBy?: 'symbol' | 'marketValue'
  setSortBy?: (value: 'symbol' | 'marketValue') => void
  performanceMode?: PerformanceMode
  setPerformanceMode?: (value: PerformanceMode) => void
  typeOptions?: { value: string; label: string }[]
  visibilityFilters?: HoldingsVisibilityFilter[]
  setVisibilityFilters?: (value: HoldingsVisibilityFilter[]) => void
  showClosedPositions?: boolean
  hasHiddenPositions?: boolean
  toolbarActions?: ReactNode
}

export const HoldingsTableMobile = ({
  holdings,
  isLoading,
  selectedTypes,
  setSelectedTypes,
  accountFilter,
  onAccountScopeChange,
  accounts,
  portfolios,
  showAccountScope = true,
  showSearch = true,
  showFilterButton = true,
  sortBy: controlledSortBy,
  setSortBy: controlledSetSortBy,
  performanceMode: controlledPerformanceMode,
  setPerformanceMode: controlledSetPerformanceMode,
  typeOptions,
  visibilityFilters = DEFAULT_HOLDINGS_VISIBILITY,
  setVisibilityFilters,
  showClosedPositions = true,
  hasHiddenPositions = false,
  toolbarActions,
}: HoldingsTableMobileProps) => {
  const numberFormatting = useNumberFormatting()
  const dateFormatting = useDateFormatting()
  const amountFormatting = useAmountFormatting()

  const formatting = {
    ...dateFormatting,
    ...numberFormatting,
    ...amountFormatting,
  }

  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)

  // Internal state for uncontrolled mode
  const [internalSortBy, setInternalSortBy] = useState<
    'symbol' | 'marketValue'
  >('marketValue')
  const [internalPerformanceMode, setInternalPerformanceMode] =
    useState<PerformanceMode>('pnl')

  const sortBy = controlledSortBy ?? internalSortBy
  const setSortBy = controlledSetSortBy ?? setInternalSortBy
  const performanceMode = controlledPerformanceMode ?? internalPerformanceMode
  const setPerformanceMode =
    controlledSetPerformanceMode ?? setInternalPerformanceMode

  const hasActiveFilters = useMemo(() => {
    const hasAccountScope = showAccountScope && accountFilter.type !== 'all'
    const hasTypeFilter = selectedTypes.length > 0
    const hasVisibilityFilter =
      hasNonDefaultHoldingsVisibility(visibilityFilters)
    return hasAccountScope || hasTypeFilter || hasVisibilityFilter
  }, [accountFilter, selectedTypes, showAccountScope, visibilityFilters])

  const filteredHoldings = useMemo(() => {
    let result = [...holdings]

    result = filterHoldingsByType(result, selectedTypes)

    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase()
      result = result.filter((holding) => {
        const nameMatch = holding.instrument?.name
          ?.toLowerCase()
          .includes(lowercasedQuery)
        const symbolMatch = holding.instrument?.symbol
          ?.toLowerCase()
          .includes(lowercasedQuery)

        return nameMatch || symbolMatch
      })
    }

    return result.sort((a, b) => {
      const cashOrder = compareCashFirst(a, b)
      if (cashOrder !== 0) return cashOrder

      if (sortBy === 'marketValue') {
        const valA = a.marketValue?.base ?? null
        const valB = b.marketValue?.base ?? null
        return compareExact(valB, valA) // Descending
      }

      const symbolA = a.instrument?.symbol?.toLowerCase() ?? ''
      const symbolB = b.instrument?.symbol?.toLowerCase() ?? ''
      if (symbolA && symbolB) {
        return symbolA.localeCompare(symbolB)
      }
      if (symbolA) {
        return -1
      }
      if (symbolB) {
        return 1
      }
      return 0
    })
  }, [holdings, selectedTypes, searchQuery, sortBy])

  const handleNavigate = (holding: Holding) => {
    // Use instrument.id (asset ID) for navigation, not symbol (which may be stripped)
    const assetId = holding.instrument?.id
    if (assetId && !assetId.startsWith('$CASH')) {
      navigate(`/holdings/${encodeURIComponent(assetId)}`, {
        state: { holding },
      })
    }
  }

  return (
    <div className="space-y-3">
      {(showSearch || showFilterButton) && (
        <div className="flex items-center gap-2">
          {showSearch && (
            <Input
              placeholder={t('wfHoldings:search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-secondary/30 h-10 min-w-0 flex-1 rounded-full border-none"
            />
          )}
          {showFilterButton && (
            <Button
              variant="outline"
              size="icon"
              className="relative size-10 shrink-0 rounded-full"
              onClick={() => setIsFilterSheetOpen(true)}
              aria-label={t('wfHoldings:open_holdings_filters')}
            >
              <Icons.ListFilter className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="bg-destructive absolute end-0 top-0.5 h-2 w-2 rounded-full" />
              )}
            </Button>
          )}
          {toolbarActions}
        </div>
      )}
      <div className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </>
        ) : filteredHoldings.length > 0 ? (
          filteredHoldings.map((holding) => {
            const symbol = holding.instrument?.symbol ?? holding.id
            const isCash =
              holding.holdingType === HoldingType.CASH ||
              symbol.startsWith('$CASH')
            const isClosed = isClosedPosition(holding)
            const parsedOption = isCash ? null : parseOccSymbol(symbol)
            const avatarSymbol = isCash
              ? `CASH:${holding.localCurrency}`
              : parsedOption
                ? parsedOption.underlying
                : symbol
            const displaySymbol = isCash
              ? t('wfHoldings:cash')
              : parsedOption
                ? parsedOption.underlying
                : symbol
            const subtitle = isCash
              ? t('wfHoldings:cash_balance')
              : parsedOption
                ? formatOptionSubtitle(
                    parsedOption,
                    holding.instrument?.currency ?? holding.localCurrency,
                    formatting,
                  )
                : (holding.instrument?.name ?? null)
            const isNavigable = !isCash && holding.instrument?.symbol

            return (
              <Card
                key={holding.id}
                className={cn(
                  'p-3',
                  isNavigable &&
                    'hover:bg-muted/50 cursor-pointer transition-colors',
                )}
                onClick={() => isNavigable && handleNavigate(holding)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-1 items-center gap-3 overflow-hidden">
                    <TickerAvatar
                      symbol={avatarSymbol}
                      exchangeMic={holding.instrument?.exchangeMic}
                      instrumentType={holding.instrument?.instrumentType}
                      assetId={holding.instrument?.id}
                      className="h-10 w-10"
                    />
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold">
                          {displaySymbol}
                        </p>
                        {isClosed && (
                          <Badge
                            variant="outline"
                            className="text-2xs h-4 px-1 py-0"
                          >
                            {t('wfHoldings:closed')}
                          </Badge>
                        )}
                      </div>
                      {subtitle && (
                        <p className="text-muted-foreground truncate text-sm">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="ms-2 text-end">
                    {isClosed ? (
                      <p className="text-muted-foreground font-medium">—</p>
                    ) : (
                      <AmountDisplay
                        value={holding.marketValue?.local ?? null}
                        currency={holding.localCurrency}
                        isHidden={isBalanceHidden}
                        className="font-medium"
                      />
                    )}
                    {isCash && (
                      <p className="text-muted-foreground text-xs">
                        {t('wfHoldings:weight_value', {
                          value: formatting.formatPercent(
                            holding.weight ?? null,
                          ),
                        })}
                      </p>
                    )}
                    {!isCash &&
                      (isClosed && performanceMode === 'daily' ? (
                        <p className="text-muted-foreground text-xs">—</p>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <AmountDisplay
                            value={
                              performanceMode === 'return'
                                ? (holding.totalReturn?.local ??
                                  holding.totalGain?.local ??
                                  null)
                                : performanceMode === 'pnl'
                                  ? (holding.totalGain?.local ?? null)
                                  : (holding.dayChange?.local ?? null)
                            }
                            currency={holding.localCurrency}
                            isHidden={isBalanceHidden}
                            colorFormat
                            className="text-xs"
                          />
                          <Separator
                            orientation="vertical"
                            className="mx-1 h-4"
                          />
                          <GainPercent
                            value={
                              performanceMode === 'return'
                                ? (holding.totalReturnPct ??
                                  holding.totalGainPct ??
                                  null)
                                : performanceMode === 'pnl'
                                  ? (holding.totalGainPct ?? null)
                                  : (holding.dayChangePct ?? null)
                            }
                            className="text-xs"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              </Card>
            )
          })
        ) : (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <h3 className="text-lg font-medium">
              {t('wfHoldings:no_positions_found')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {holdings.length === 0 && !hasHiddenPositions
                ? t('wfHoldings:add_activities_prompt')
                : t('wfHoldings:try_adjusting_filters')}
            </p>
          </div>
        )}
      </div>

      {/* Filter Sheet */}
      <HoldingsMobileFilterSheet
        open={isFilterSheetOpen}
        onOpenChange={setIsFilterSheetOpen}
        accountFilter={accountFilter}
        onAccountScopeChange={onAccountScopeChange}
        accounts={accounts}
        portfolios={portfolios}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
        showAccountScope={showAccountScope}
        sortBy={sortBy}
        setSortBy={setSortBy}
        performanceMode={performanceMode}
        setPerformanceMode={setPerformanceMode}
        typeOptions={typeOptions}
        visibilityFilters={visibilityFilters}
        setVisibilityFilters={setVisibilityFilters}
        showClosedPositions={showClosedPositions}
      />
    </div>
  )
}

export default HoldingsTableMobile
