import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  getDashboard,
  getTransactions,
  localDate,
  label,
  type Account,
  type Category,
} from '@/lib/api'
import { activityPercent, subtractMoney } from '@/lib/money'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
  Panel,
  SummaryMetric,
} from '@/components/primitives'
import { TransactionTable } from '@/components/transaction-table'
import type { Navigate } from '@/components/app-shell'

export default function Dashboard({
  accounts,
  categories,
  navigate,
}: {
  accounts: Account[]
  categories: Category[]
  navigate: Navigate
}) {
  const [month, setMonth] = useState(localDate().slice(0, 7))
  const start = new Date(`${month}-01T12:00:00`)
  const last = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  const monthTitle = new Intl.DateTimeFormat(navigator.language, {
    month: 'long',
    year: 'numeric',
  }).format(start)
  function moveMonth(delta: number) {
    const target = new Date(start.getFullYear(), start.getMonth() + delta, 1)
    setMonth(
      `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`,
    )
  }
  const result = useQuery({
    queryKey: ['dashboard', month],
    queryFn: ({ signal }) => getDashboard(month, signal),
  })
  const recent = useQuery({
    queryKey: ['transactions', 'dashboard', month],
    queryFn: ({ signal }) =>
      getTransactions(
        new URLSearchParams({
          date_from: `${month}-01`,
          date_to: `${month}-${last.getDate()}`,
          limit: '8',
        }),
        signal,
      ),
  })
  return (
    <>
      <PageHeader
        title="Overview"
        description="Your accounts and this month's cash flow."
      >
        <div className="month-picker">
          <button
            className="icon-button"
            aria-label="Previous month"
            disabled={month === '0001-01'}
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>{monthTitle}</span>
          <button
            className="icon-button"
            aria-label="Next month"
            disabled={month === '9999-11'}
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </PageHeader>
      {result.isPending ? (
        <LoadingState text="Loading summary…" />
      ) : result.isError ? (
        <ErrorState
          text="Unable to load dashboard."
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {!result.data.totals.length && (
            <EmptyState
              title="No accounts yet"
              detail="Create an account to start your financial overview."
            />
          )}
          {result.data.totals.map((total) => (
            <section
              aria-label={`${total.currency} summary`}
              className="summary-strip"
              key={total.currency}
            >
              <SummaryMetric
                title="Total account value"
                value={total.total_balance}
                currency={total.currency}
                detail={`${total.currency} · All recorded dates`}
              />
              <SummaryMetric
                title="Monthly income"
                value={total.income}
                currency={total.currency}
                detail={monthTitle}
                tone="positive"
              />
              <SummaryMetric
                title="Monthly expenses"
                value={total.expenses}
                currency={total.currency}
                detail={monthTitle}
                tone="negative"
              />
              <SummaryMetric
                title="Net cash flow"
                value={subtractMoney(total.income, total.expenses)}
                currency={total.currency}
                detail="Income minus expenses"
                tone={
                  subtractMoney(total.income, total.expenses).startsWith('-')
                    ? 'negative'
                    : 'positive'
                }
              />
            </section>
          ))}
          <div className="dashboard-grid">
            <Panel
              title="Monthly activity"
              detail={`${monthTitle} · Income and expenses only`}
            >
              {!result.data.totals.length && (
                <EmptyState title="No activity to compare" />
              )}
              {result.data.totals.map((t) => (
                <div className="activity" key={t.currency}>
                  <div className="section-eyebrow">{t.currency}</div>
                  {[
                    ['Income', t.income, 'positive'],
                    ['Expenses', t.expenses, 'negative'],
                  ].map(([name, amount, tone]) => (
                    <div className="activity-row" key={name}>
                      <div className="flex justify-between gap-3">
                        <span>{name}</span>
                        <Money value={amount} currency={t.currency} />
                      </div>
                      <div className="activity-track" aria-hidden="true">
                        <div
                          className={tone}
                          style={{
                            width: `${activityPercent(amount, t.income, t.expenses)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <p className="metadata mt-4">
                Transfers and opening balances are excluded.
              </p>
            </Panel>
            <Panel
              title="Account balances"
              detail="All accounts · Original currencies"
            >
              {!accounts.length && <EmptyState title="No accounts yet" />}
              {accounts.map((a) => (
                <button
                  className="account-summary"
                  key={a.id}
                  onClick={() => navigate('Account', a.id)}
                >
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {label(a.type)}
                      {!a.active && ' · Inactive'}
                    </small>
                  </span>
                  <Money
                    value={a.balance}
                    currency={a.currency}
                    tone={a.balance.startsWith('-') ? 'negative' : 'neutral'}
                  />
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              ))}
              <p className="metadata mt-3">
                Includes inactive accounts. Investment accounts show ledger cash
                only.
              </p>
            </Panel>
            <Panel
              title="Recent transactions"
              detail={`${monthTitle} · Latest 8 ledger entries`}
              className="dashboard-ledger"
            >
              {recent.isPending ? (
                <LoadingState text="Loading transactions…" />
              ) : recent.isError ? (
                <ErrorState
                  text="Unable to load transactions."
                  retry={() => void recent.refetch()}
                />
              ) : (
                <TransactionTable
                  rows={recent.data}
                  accounts={accounts}
                  categories={categories}
                />
              )}
              <button
                className="text-action mt-3"
                onClick={() => navigate('Transactions')}
              >
                Open full ledger <ArrowRight size={13} aria-hidden="true" />
              </button>
            </Panel>
          </div>
        </>
      )}
    </>
  )
}
