import { compareExact } from './compat'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted source: Wealthfolio 92b4647 pages/holdings/components/alternative-holdings-table.tsx; see THIRD_PARTY_NOTICES.md.
import { useBalancePrivacy } from './compat'
import type { AlternativeAssetHolding } from './types'
import { ALTERNATIVE_ASSET_KIND_DISPLAY_NAMES } from './types'
import type { ColumnDef } from '@tanstack/react-table'
import {
  AmountDisplay,
  GainPercent,
  useDateFormatting,
  Spinner,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from './ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/vendor/wealthfolio/ui/components/ui/alert-dialog'
import { Button } from '@/vendor/wealthfolio/ui/components/ui/button'
import { DataTable } from '@/vendor/wealthfolio/ui/components/ui/data-table'
import { DataTableColumnHeader } from '@/vendor/wealthfolio/ui/components/ui/data-table/data-table-column-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/vendor/wealthfolio/ui/components/ui/dropdown-menu'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import { Skeleton } from '@/vendor/wealthfolio/ui/components/ui/skeleton'
import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  HOLDINGS_TABLE_DENSITY,
  PERCENT_BADGE,
  ROW_ACTIONS_TRIGGER,
} from './holdings-table-styles'

interface AlternativeHoldingsTableProps {
  holdings: AlternativeAssetHolding[]
  isLoading: boolean
  emptyTitle?: string
  emptyDescription?: string
  onEdit?: (holding: AlternativeAssetHolding) => void
  onUpdateValue?: (holding: AlternativeAssetHolding) => void
  onViewHistory?: (holding: AlternativeAssetHolding) => void
  onDelete?: (holding: AlternativeAssetHolding) => void
  onRowClick?: (holding: AlternativeAssetHolding) => void
  isDeleting?: boolean
}

export function AlternativeHoldingsTable({
  holdings,
  isLoading,
  emptyTitle,
  emptyDescription,
  onEdit,
  onUpdateValue,
  onViewHistory,
  onDelete,
  onRowClick,
  isDeleting = false,
}: AlternativeHoldingsTableProps) {
  const formatting = useDateFormatting()
  const { t } = useTranslation()
  const resolvedEmptyTitle = emptyTitle ?? t('wfHoldings:empty_no_assets_yet')
  const resolvedEmptyDescription =
    emptyDescription ?? t('wfHoldings:empty_add_first_asset_button')
  const { isBalanceHidden } = useBalancePrivacy()
  const [assetToDelete, setAssetToDelete] =
    useState<AlternativeAssetHolding | null>(null)

  const handleConfirmDelete = () => {
    if (assetToDelete && onDelete) {
      onDelete(assetToDelete)
      setAssetToDelete(null)
    }
  }

  const columns: ColumnDef<AlternativeAssetHolding>[] = useMemo(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('wfHoldings:asset')}
          />
        ),
        cell: ({ row }) => {
          const holding = row.original
          const kindDisplay =
            ALTERNATIVE_ASSET_KIND_DISPLAY_NAMES[
              holding.kind.toUpperCase() as keyof typeof ALTERNATIVE_ASSET_KIND_DISPLAY_NAMES
            ] ?? holding.kind

          const handleClick = () => {
            if (onRowClick) {
              onRowClick(holding)
            }
          }

          return (
            <div
              className={`flex items-center gap-3 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={handleClick}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleClick()
                      }
                    }
                  : undefined
              }
            >
              <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <AssetKindIcon kind={holding.kind} size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{holding.name}</span>
                <span className="text-muted-foreground text-xs">
                  {kindDisplay}
                </span>
              </div>
            </div>
          )
        },
        enableSorting: true,
      },
      {
        id: 'marketValue',
        accessorKey: 'marketValue',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('wfHoldings:sort_value')}
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const holding = row.original
          const value = holding.marketValue

          return (
            <div className="text-end">
              <AmountDisplay
                value={value}
                currency={holding.currency}
                isHidden={isBalanceHidden}
                displayCurrency={true}
              />
            </div>
          )
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const valueA = rowA.original.marketValue
          const valueB = rowB.original.marketValue
          return compareExact(valueA, valueB)
        },
      },
      {
        id: 'gain',
        accessorKey: 'unrealizedGain',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('wfHoldings:sort_gain')}
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const holding = row.original
          const gain = holding.unrealizedGain ? holding.unrealizedGain : null
          const gainPct = holding.unrealizedGainPct
            ? holding.unrealizedGainPct
            : null
          const isLiability = holding.kind.toLowerCase() === 'liability'

          if (gain === null || gainPct === null) {
            return (
              <div className="text-muted-foreground text-end text-sm">—</div>
            )
          }

          return (
            <div className="flex flex-col items-end">
              <AmountDisplay
                value={gain}
                currency={holding.currency}
                isHidden={isBalanceHidden}
                displayCurrency={false}
                colorFormat={true}
                invertColor={isLiability}
              />
              <GainPercent
                value={gainPct}
                animated={false}
                variant="badge"
                className={PERCENT_BADGE}
                invertColor={isLiability}
              />
            </div>
          )
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const valueA = rowA.original.unrealizedGain ?? '0'
          const valueB = rowB.original.unrealizedGain ?? '0'
          return compareExact(valueA, valueB)
        },
      },
      {
        id: 'valuationDate',
        accessorKey: 'valuationDate',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('wfHoldings:last_valued')}
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const holding = row.original
          const formatted = formatting.formatCalendarDate(
            holding.valuationDate?.split('T')[0] ?? null,
            {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            },
          )

          return (
            <div className="text-muted-foreground text-end text-sm">
              {formatted}
            </div>
          )
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const holding = row.original

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('wfHoldings:open_actions')}
                      className={ROW_ACTIONS_TRIGGER}
                    />
                  }
                >
                  <Icons.MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onUpdateValue && (
                    <DropdownMenuItem onClick={() => onUpdateValue(holding)}>
                      <Icons.DollarSign className="me-2 h-4 w-4" />
                      {t('wfHoldings:update_value')}
                    </DropdownMenuItem>
                  )}
                  {onViewHistory && (
                    <DropdownMenuItem onClick={() => onViewHistory(holding)}>
                      <Icons.History className="me-2 h-4 w-4" />
                      {t('wfHoldings:value_history')}
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(holding)}>
                      <Icons.Pencil className="me-2 h-4 w-4" />
                      {t('wfHoldings:edit_details')}
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setAssetToDelete(holding)}
                      >
                        <Icons.Trash className="me-2 h-4 w-4" />
                        {t('holdingsMigration:closeRecord')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [
      formatting,
      isBalanceHidden,
      onEdit,
      onUpdateValue,
      onViewHistory,
      onDelete,
      onRowClick,
      t,
    ],
  )

  if (isLoading) {
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (!holdings || holdings.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {<Icons.Wallet className="text-muted-foreground size-10" />}
            </EmptyMedia>
            <EmptyTitle>{resolvedEmptyTitle}</EmptyTitle>
            <EmptyDescription>{resolvedEmptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <>
      <div className={HOLDINGS_TABLE_DENSITY}>
        <DataTable
          data={holdings}
          columns={columns}
          searchBy="name"
          defaultSorting={[{ id: 'marketValue', desc: true }]}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={assetToDelete !== null}
        onOpenChange={(open) => !open && setAssetToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('holdingsMigration:closeRecord')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans
                i18nKey="holdingsMigration:closeDetails"
                values={{ name: assetToDelete?.name }}
                components={{ bold: <span className="font-semibold" /> }}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('wfCommon:cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? (
                <>
                  <Spinner className="me-2 h-4 w-4" />
                  {t('wfHoldings:deleting')}
                </>
              ) : (
                t('holdingsMigration:closeRecord')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Icon component for alternative asset kinds (duotone style)
 */
function AssetKindIcon({ kind, size = 20 }: { kind: string; size?: number }) {
  switch (kind.toLowerCase()) {
    case 'property':
      return <Icons.RealEstateDuotone size={size} />
    case 'vehicle':
      return <Icons.VehicleDuotone size={size} />
    case 'collectible':
      return <Icons.CollectibleDuotone size={size} />
    case 'precious':
      return <Icons.PreciousDuotone size={size} />
    case 'liability':
      return <Icons.LiabilityDuotone size={size} />
    default:
      return <Icons.OtherAssetDuotone size={size} />
  }
}

export default AlternativeHoldingsTable
