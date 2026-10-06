import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell, type Page } from '@/components/app-shell'
import { ErrorState, LoadingState, PageHeader } from '@/components/primitives'
import { getAccounts, getCategories } from '@/lib/api'
import Dashboard from '@/pages/dashboard'
import Transactions from '@/pages/transactions'
import { Accounts, Categories, Transfers } from '@/pages/management'

export default function App() {
  const [route, setRoute] = useState<{ page: Page; accountId?: string }>({
    page: 'Dashboard',
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
    <AppShell {...route} accounts={accounts.data ?? []} navigate={navigate}>
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
          {route.page === 'Dashboard' && (
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
              key="ledger"
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
          {route.page === 'Transfers' && (
            <Transfers accounts={accounts.data} categories={categories.data} />
          )}
          {route.page === 'Categories' && (
            <Categories categories={categories.data} />
          )}
        </>
      )}
    </AppShell>
  )
}
