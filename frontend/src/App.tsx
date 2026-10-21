import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell, type Page } from '@/components/app-shell'
import { ErrorState, LoadingState, PageHeader } from '@/components/primitives'
import { getAccounts, getCategories } from '@/lib/api'
import { navigateTo, useRoute } from '@/lib/navigation'
import Dashboard from '@/pages/dashboard'
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
  const route = useRoute()
  const filters = Object.fromEntries(
    [...route.params].filter(
      ([key]) => !['view', 'account', 'reconcile'].includes(key),
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
          <PageHeader title="Workspace" />
          <LoadingState text="Loading workspace…" />
        </>
      ) : accounts.isError || categories.isError ? (
        <>
          <PageHeader title="Workspace" />
          <ErrorState
            text="Unable to load your local workspace. Check that the API is running."
            retry={() => {
              void accounts.refetch()
              void categories.refetch()
            }}
          />
        </>
      ) : (
        <Suspense fallback={<LoadingState text="Loading page…" />}>
          {route.page === 'Overview' && (
            <Dashboard
              accounts={accounts.data}
              categories={categories.data}
              navigate={navigate}
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
                text="Account no longer available."
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
