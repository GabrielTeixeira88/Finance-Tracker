// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/pages/activity/components/activity-pagination.tsx; exact local adapters.
import { Spinner } from '../holdings/ui'
import { useTranslation } from 'react-i18next'

interface ActivityPaginationProps {
  isFetching: boolean
  totalFetched: number
  totalCount: number
}

export function ActivityPagination({
  isFetching,
  totalFetched,
  totalCount,
}: ActivityPaginationProps) {
  const { t } = useTranslation()
  return (
    <div className="my-3 flex shrink-0 items-center justify-center">
      <div
        role="status"
        aria-live="polite"
        className="text-muted-foreground flex items-center gap-2 text-xs"
      >
        {isFetching ? <Spinner className="h-4 w-4" aria-hidden="true" /> : null}
        <span>
          {t('wfActivity:pagination_count', {
            fetched: totalFetched,
            total: totalCount,
          })}
        </span>
      </div>
    </div>
  )
}
