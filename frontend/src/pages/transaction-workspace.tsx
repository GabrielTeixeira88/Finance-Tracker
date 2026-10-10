import { useState } from 'react'
import { type Account, type Category } from '@/lib/api'
import Transactions from './transactions'
import Schedules from './schedules'

export default function TransactionWorkspace(props: {
  accounts: Account[]
  categories: Category[]
  account?: Account
}) {
  const [view, setView] = useState<'activity' | 'scheduled'>('activity')
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
        </nav>
      )}
      {view === 'activity' || props.account ? (
        <Transactions {...props} />
      ) : (
        <Schedules accounts={props.accounts} categories={props.categories} />
      )}
    </>
  )
}
