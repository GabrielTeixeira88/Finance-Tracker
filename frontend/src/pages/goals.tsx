import type { Account } from '@/lib/api'
import { useRoute } from '@/lib/navigation'
import { useQuery } from '@tanstack/react-query'
import { getGoals } from '@/lib/wealth-api'
import { LoadingState, ErrorState } from '@/components/primitives'
import { PortalScope } from '@/vendor/wealthfolio/ui/components/ui/portal-scope'
import { I18nProvider } from 'react-aria-components'
import { getLocale } from '@/lib/preferences'
import GoalsDashboardPage from '@/features/goals/pages/goals-dashboard-page'
import GoalNewPage from '@/features/goals/pages/goal-new-page'
import GoalDetailPage from '@/features/goals/pages/goal-detail-page'
import '@/features/goals/i18n'
import '@/features/goals/goals.css'
import '@/features/holdings/migration.css'
export default function Goals({ accounts }: { accounts: Account[] }) {
  const route = useRoute(),
    goals = useQuery({ queryKey: ['goals'], queryFn: getGoals })
  const selected = route.params.get('goal'),
    creating = route.params.get('new') === 'true'
  return (
    <PortalScope name="holdings-migration">
      <I18nProvider locale={getLocale()}>
        <section className="wf-workspace goals-workspace">
          {selected ? (
            <GoalDetailPage key={selected} goalId={selected} />
          ) : creating ? (
            goals.isPending ? (
              <LoadingState />
            ) : goals.isError ? (
              <ErrorState
                text={goals.error.message}
                retry={() => void goals.refetch()}
              />
            ) : (
              <GoalNewPage
                defaultCurrency={
                  accounts.find((account) => account.active)?.currency ?? 'BRL'
                }
              />
            )
          ) : (
            <GoalsDashboardPage />
          )}
        </section>
      </I18nProvider>
    </PortalScope>
  )
}
