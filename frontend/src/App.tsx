import { t as tr } from '@/lib/i18n'
import { useTranslation } from 'react-i18next'
import { HandCoins, TrendingUp, Wallet } from 'lucide-react'
import '@/lib/i18n'
import '@/features/dashboard/dashboard.css'
import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell, type Page } from '@/components/app-shell'
import { ErrorState, LoadingState, PageHeader } from '@/components/primitives'
import { getAccounts, getCategories, getDemoDate, localDate } from '@/lib/api'
import { FinancialPrivacy } from '@/components/financial-privacy'
import { dashboardTabParams } from '@/features/dashboard/period'
import { navigateTo, useRoute } from '@/lib/navigation'
import { SectionNavigation } from '@/components/section-navigation'
import { Accounts } from '@/features/settings/management-components'
import type { PreviewPage } from '@/pages/previews'
import {
  DemoExperience,
  HistoricalDemoFooter,
} from '@/components/demo-experience'

const Settings = lazy(() =>
  import('@/features/settings/settings-page').then((module) => ({
    default: module.Settings,
  })),
)
const Spending = lazy(() => import('@/pages/spending'))
const Transactions = lazy(() => import('@/pages/transaction-workspace'))
const Investments = lazy(() => import('@/pages/investments'))
const InvestmentsDashboard = lazy(
  () => import('@/features/dashboard/investments-dashboard'),
)
const Preview = lazy(() => import('@/pages/previews'))
const NetWorth = lazy(() => import('@/pages/wealth'))
const Goals = lazy(() => import('@/pages/goals'))
const ActivitiesPage = lazy(
  () => import('@/features/activities/activities-page'),
)
const HoldingsPage = lazy(() => import('@/features/holdings/holdings-page'))
const ImportPage = lazy(
  () => import('@/features/activities/import/import-page'),
)
const AccountProfilePage = lazy(
  () => import('@/features/holdings/account-profile-page'),
)

export default function App() {
  useTranslation()
  const route = useRoute()
  const filters = Object.fromEntries(
    [...route.params].filter(
      ([key]) =>
        ![
          'view',
          'account',
          'reconcile',
          'tool',
          'kind',
          'section',
          'detail',
          'stage',
        ].includes(key),
    ),
  )
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: ({ signal }) => getAccounts(signal),
  })
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => getCategories(signal),
  })
  const navigate = (page: Page, accountId?: string) =>
    navigateTo(page, accountId)
  const selected = accounts.data?.find((a) => a.id === route.accountId)
  return (
    <FinancialPrivacy>
      <AppShell page={route.page} navigate={navigate}>
        <DemoExperience />
        {accounts.isPending || categories.isPending ? (
          <>
            <PageHeader title={tr('App:workspace_4ca0a7')} />
            <LoadingState text={tr('App:loading_workspace__89f0dd')} />
          </>
        ) : accounts.isError || categories.isError ? (
          <>
            <PageHeader title={tr('App:workspace_4ca0a7')} />
            <ErrorState
              text={tr(
                'App:unable_to_load_your_local_workspace_check_that_t_3edca9',
              )}
              retry={() => {
                void accounts.refetch()
                void categories.refetch()
              }}
            />
          </>
        ) : (
          <Suspense
            fallback={<LoadingState text={tr('App:loading_page__053228')} />}
          >
            {((route.page === 'Budget' && !route.params.has('detail')) ||
              (route.page === 'Net Worth' && !route.params.has('position')) ||
              (route.page === 'Investments' &&
                ['Overview', null].includes(route.params.get('view')))) && (
              <SectionNavigation
                label="Dashboard"
                icons={{
                  Budget: <HandCoins size={14} aria-hidden />,
                  Investments: <TrendingUp size={14} aria-hidden />,
                  'Net Worth': <Wallet size={14} aria-hidden />,
                }}
                items={
                  [
                    ['Budget', 'Spending'],
                    ['Investments', 'Investments'],
                    ['Net Worth', 'Net Worth'],
                  ] as const
                }
                value={route.page as 'Budget' | 'Investments' | 'Net Worth'}
                onChange={(page) =>
                  navigateTo(
                    page,
                    undefined,
                    dashboardTabParams(
                      route.page,
                      route.params,
                      getDemoDate() || localDate(),
                    ),
                  )
                }
              />
            )}
            {route.page === 'Accounts' && (
              <Accounts accounts={accounts.data} navigate={navigate} />
            )}
            {route.page === 'Transactions' && (
              <Transactions
                key={JSON.stringify(filters)}
                initialFilters={filters}
                accounts={accounts.data}
                categories={categories.data}
              />
            )}
            {route.page === 'Account' &&
              (selected ? (
                <AccountProfilePage
                  key={selected.id}
                  initialFilters={filters}
                  account={selected}
                  accounts={accounts.data}
                  categories={categories.data}
                />
              ) : (
                <ErrorState
                  text={tr('App:account_no_longer_available__2766ba')}
                  retry={() => navigate('Accounts')}
                />
              ))}
            {route.page === 'Settings' && (
              <Settings categories={categories.data} accounts={accounts.data} />
            )}
            {route.page === 'Budget' && (
              <Spending
                accounts={accounts.data}
                categories={categories.data}
                onTransactions={(filters) =>
                  navigateTo('Transactions', undefined, filters)
                }
              />
            )}
            {route.page === 'Investments' &&
            route.params.get('view') === 'Holdings' ? (
              <HoldingsPage accounts={accounts.data} />
            ) : route.page === 'Investments' &&
              route.params.get('view') === 'Activity' ? (
              <ActivitiesPage
                initialInvestment
                accounts={accounts.data}
                categories={categories.data}
                initialFilters={filters}
              />
            ) : route.page === 'Investments' &&
              route.params.get('view') === 'Imports' ? (
              <ImportPage
                investment
                accountId={route.accountId}
                accounts={accounts.data}
                categories={categories.data}
              />
            ) : route.page === 'Investments' &&
              ['Overview', null].includes(route.params.get('view')) ? (
              <InvestmentsDashboard />
            ) : (
              ['Investments', 'Performance'].includes(route.page) && (
                <Investments
                  key={`${route.page}-${route.accountId ?? 'all'}`}
                  initialView={
                    route.page === 'Performance' ? 'Performance' : 'Overview'
                  }
                  initialAccount={route.accountId}
                  accounts={accounts.data}
                  categories={categories.data}
                />
              )
            )}
            {route.page === 'Net Worth' && (
              <NetWorth accounts={accounts.data} navigate={navigate} />
            )}
            {route.page === 'Goals' && <Goals accounts={accounts.data} />}
            {route.page === 'Reports' && (
              <Preview
                key={route.page}
                page={route.page as PreviewPage}
                navigate={navigate}
              />
            )}
          </Suspense>
        )}
        <HistoricalDemoFooter />
      </AppShell>
    </FinancialPrivacy>
  )
}
