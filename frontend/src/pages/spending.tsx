import { useQuery } from '@tanstack/react-query'
import { getDemo, type Account, type Category } from '@/lib/api'
import { getBudget } from '@/lib/budget-api'
import { t } from '@/lib/i18n'
import { useRoute } from '@/lib/navigation'
import { ErrorState, LoadingState } from '@/components/primitives'
import SpendingDashboard from '@/features/spending/pages/spending-dashboard'
import SpendingBudgetPage from '@/features/spending/pages/spending-budget-page'
import SpendingInsightsPage from '@/features/spending/pages/spending-insights-page'
import './spending.css'
type Props = {
  accounts: Account[]
  categories: Category[]
  onTransactions: (filters: Record<string, string>) => void
}
export default function Spending(props: Props) {
  const demo = useQuery({
    queryKey: ['demo'],
    queryFn: ({ signal }) => getDemo(signal),
  })
  if (demo.isPending)
    return (
      <LoadingState text={t('spending:loading_spending_workspace__7ffd37')} />
    )
  if (demo.isError)
    return (
      <ErrorState text={demo.error.message} retry={() => void demo.refetch()} />
    )
  const now = new Date(),
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return (
    <SpendingWorkspace
      {...props}
      initialMonth={demo.data.enabled ? demo.data.end_date.slice(0, 7) : month}
    />
  )
}
/** One canonical workspace router; incomplete queries never render obsolete interactive controls. */
export function SpendingWorkspace({
  accounts,
  categories,
  initialMonth,
}: Props & { initialMonth: string }) {
  const route = useRoute(),
    candidate = route.params.get('month') ?? ''
  const month = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(candidate)
    ? candidate
    : initialMonth
  const currency =
    route.params.get('currency') ?? accounts[0]?.currency ?? 'BRL'
  const query = useQuery({
    queryKey: ['budgets', month, currency],
    queryFn: ({ signal }) => getBudget(month, currency, signal),
  })
  if (query.isPending)
    return <LoadingState text={t('spending:calculating_spending__06a346')} />
  if (query.isError)
    return (
      <ErrorState
        text={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  const view = route.params.get('view')
  if (view === 'Budgets')
    return (
      <SpendingBudgetPage
        month={month}
        currency={currency}
        asOf={query.data.as_of}
        categories={categories}
        accounts={accounts}
      />
    )
  if (view === 'Insights' || view === 'Life Events')
    return (
      <SpendingInsightsPage
        data={query.data}
        categories={categories}
        accounts={accounts}
      />
    )
  return (
    <SpendingDashboard
      asOf={query.data.as_of}
      currency={currency}
      categories={categories}
      accounts={accounts}
      budgetReport={query.data}
    />
  )
}
