import { useState } from 'react'
import { type Account, type Category } from '@/lib/api'
import Transactions from './transactions'
import Schedules from './schedules'
import ImportWorkspace from './import-workspace'

export default function TransactionWorkspace(props: {
  accounts: Account[]
  categories: Category[]
  account?: Account
}) {
  const [view, setView] = useState<'activity' | 'scheduled' | 'imports'>(
    'activity',
  )
  return (
    <>
      {!props.account && (
        <nav className="range-tabs mb-4" aria-label="Transaction views">
          <button
            aria-pressed={view === 'activity'}
            onClick={() => setView('activity')}
          >
            All Activity
          </button>
          <button
            aria-pressed={view === 'scheduled'}
            onClick={() => setView('scheduled')}
          >
            Scheduled
          </button>
          <button
            aria-pressed={view === 'imports'}
            onClick={() => setView('imports')}
          >
            Imports
          </button>
        </nav>
      )}
      {view === 'activity' || props.account ? (
        <Transactions {...props} />
      ) : view === 'imports' ? (
        <ImportWorkspace
          accounts={props.accounts}
          categories={props.categories}
        />
      ) : (
        <Schedules accounts={props.accounts} categories={props.categories} />
      )}
    </>
  )
}
