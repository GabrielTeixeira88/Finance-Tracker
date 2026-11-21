// Source action-menu presentation adapted from Wealthfolio 92b4647 activity-operations.tsx.
// Local actions inspect, copy to an unposted draft, or void through existing guards.
import type { Row } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { navigateTo } from '@/lib/navigation'
import type { ActivityDetails } from './activity-compat'
import { Button } from '../holdings/ui'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/vendor/wealthfolio/ui/components/ui/dropdown-menu'
export function ActivityOperations({
  row,
  activity,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  row?: Row<ActivityDetails>
  activity?: ActivityDetails
  onEdit: (row: ActivityDetails) => void
  onDelete: (row: ActivityDetails) => void
  onDuplicate: (row: ActivityDetails) => Promise<void>
  onLinkTransfer?: unknown
  onUnlinkTransfer?: unknown
  hoverReveal?: boolean
  touch?: boolean
}) {
  const { t } = useTranslation()
  const entry = activity ?? row?.original
  if (!entry) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t('wfCommon:actions')}
          />
        }
      >
        <Icons.MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(entry)}>
          {t('holdingsMigration:inspect')}
        </DropdownMenuItem>
        {entry.fixedIncome ? (
          <DropdownMenuItem
            onClick={() =>
              navigateTo('Investments', entry.accountId, {
                view: 'Fixed Income',
                asset: entry.assetId,
                end: entry.date,
              })
            }
          >
            {t('fixed_income:title')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => void onDuplicate(entry)}>
            {t('holdingsMigration:duplicateDraft')}
          </DropdownMenuItem>
        )}
        {!entry.fixedIncome && !entry.original.voided_at && (
          <DropdownMenuItem onClick={() => onDelete(entry)}>
            {t('investments:void_207c7c')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
