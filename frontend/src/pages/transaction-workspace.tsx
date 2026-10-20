import { useSection } from '@/lib/navigation'
import { SectionNavigation } from '@/components/section-navigation'
import { type Account, type Category } from '@/lib/api'
import Transactions from './transactions'
import Schedules from './schedules'
import ImportWorkspace from './import-workspace'
import { GmailQueue } from './gmail'
import Reconciliation from './reconciliation'

export default function TransactionWorkspace(props: {
  accounts: Account[]
  categories: Category[]
  initialFilters?: Record<string, string>
  account?: Account
}) {
  const items = props.account
    ? ([
        ['activity', 'All Activity'],
        ['reconciliation', 'Reconcile'],
      ] as const)
    : ([
        ['activity', 'All Activity'],
        ['scheduled', 'Scheduled'],
        ['imports', 'Imports'],
        ['gmail', 'Gmail review'],
        ['reconciliation', 'Reconcile'],
      ] as const)
  const [view, setView] = useSection(
    items.map(([key]) => key),
    'activity',
  )
  return (
    <>
      <SectionNavigation
        label="Transaction views"
        items={items}
        value={view}
        onChange={setView}
      />
      {view === 'reconciliation' ? (
        <Reconciliation {...props} />
      ) : view === 'activity' ? (
        <Transactions {...props} />
      ) : view === 'imports' ? (
        <ImportWorkspace
          accounts={props.accounts}
          categories={props.categories}
        />
      ) : view === 'gmail' ? (
        <GmailQueue accounts={props.accounts} categories={props.categories} />
      ) : (
        <Schedules accounts={props.accounts} categories={props.categories} />
      )}
    </>
  )
}
