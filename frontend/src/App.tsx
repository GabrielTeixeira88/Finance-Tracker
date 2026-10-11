import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell, type Page } from '@/components/app-shell'
import { ErrorState, LoadingState, PageHeader } from '@/components/primitives'
import { getAccounts, getCategories } from '@/lib/api'
import Spending from '@/pages/spending'
import Dashboard from '@/pages/dashboard'
import Transactions from '@/pages/transaction-workspace'
import { Accounts, Settings } from '@/pages/management'
import Preview, { type PreviewPage } from '@/pages/previews'

export default function App() {
  const [route, setRoute] = useState<{
    page: Page
    accountId?: string
    filters?: Record<string, string>
  }>({
    page: 'Overview',
  })
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: ({ signal }) => getAccounts(signal),
  })
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => getCategories(signal),
  })
  const navigate = (page: Page, accountId?: string) =>
    setRoute({ page, accountId })
  const selected = accounts.data?.find((a) => a.id === route.accountId)
  return (
    <AppShell page={route.page} navigate={navigate}>
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
        <>
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
              key={JSON.stringify(route.filters ?? {})}
              initialFilters={route.filters}
              accounts={accounts.data}
              categories={categories.data}
            />
          )}
          {route.page === 'Account' &&
            (selected ? (
              <Transactions
                key={selected.id}
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
                setRoute({ page: 'Transactions', filters })
              }
            />
          )}
          {['Investments', 'Performance', 'Net Worth', 'Reports'].includes(
            route.page,
          ) && (
            <Preview
              key={route.page}
              page={route.page as PreviewPage}
              navigate={navigate}
            />
          )}
        </>
      )}
    </AppShell>
  )
}
