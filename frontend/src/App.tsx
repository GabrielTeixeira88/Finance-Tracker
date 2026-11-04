import { t as tr } from '@/lib/i18n'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'
import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell, type Page } from '@/components/app-shell'
import { ErrorState, LoadingState, PageHeader } from '@/components/primitives'
import { getAccounts, getCategories } from '@/lib/api'
import { navigateTo, useRoute } from '@/lib/navigation'
import { SectionNavigation } from '@/components/section-navigation'
import Transactions from '@/pages/transaction-workspace'
import { Accounts, Settings } from '@/pages/management'
import type { PreviewPage } from '@/pages/previews'
import { DemoExperience } from '@/components/demo-experience'

const Spending = lazy(() => import('@/pages/spending'))
const Investments = lazy(() => import('@/pages/investments'))
const Preview = lazy(() => import('@/pages/previews'))
const NetWorth = lazy(() => import('@/pages/wealth'))
const Goals = lazy(() => import('@/pages/goals'))

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
              items={
                [
                  ['Budget', 'Spending'],
                  ['Investments', 'Investments'],
                  ['Net Worth', 'Net Worth'],
                ] as const
              }
              value={route.page as 'Budget' | 'Investments' | 'Net Worth'}
              onChange={(page) => navigateTo(page)}
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
            (selected?.type === 'INVESTMENT' ? (
              <Investments
                key={selected.id}
                initialAccount={selected.id}
                accounts={accounts.data}
                categories={categories.data}
              />
            ) : selected ? (
              <Transactions
                key={`${selected.id}-${JSON.stringify(filters)}`}
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
          {['Investments', 'Performance'].includes(route.page) && (
            <Investments
              key={`${route.page}-${route.accountId ?? 'all'}`}
              initialView={
                route.page === 'Performance' ? 'Performance' : 'Overview'
              }
              initialAccount={route.accountId}
              accounts={accounts.data}
              categories={categories.data}
            />
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
    </AppShell>
  )
}
