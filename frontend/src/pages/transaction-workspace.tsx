import { useState } from 'react'
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
  const [view, setView] = useState<
    'activity' | 'scheduled' | 'imports' | 'gmail' | 'reconciliation'
  >('activity')
  return (
    <>
      <nav
        className="range-tabs mb-4 flex-wrap max-w-full"
        aria-label="Transaction views"
      >
        {(
          [
            ['activity', 'All Activity'],
            ['reconciliation', 'Reconcile'],
            ...(!props.account
              ? [
                  ['gmail', 'Gmail review'],
                  ['scheduled', 'Scheduled'],
                  ['imports', 'Imports'],
                ]
              : []),
          ] as const
        ).map(([key, title]) => (
          <button
            key={key}
            aria-pressed={view === key}
            onClick={() => setView(key as typeof view)}
          >
            {title}
          </button>
        ))}
      </nav>
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
