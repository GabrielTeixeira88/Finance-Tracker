import { ArrowRight, ArrowLeftRight, ChevronRight } from 'lucide-react'
import {
  periods,
  label,
  type Period,
  type Account,
  type Category,
  type Transaction,
  type HistorySeries,
} from '@/lib/api'
import { activityPercent } from '@/lib/money'
import type { Navigate } from './app-shell'
import { EmptyState, Money } from './primitives'

export function DateRangeTabs({
  value,
  onChange,
}: {
  value: Period
  onChange: (value: Period) => void
}) {
  return (
    <div className="range-tabs" role="group" aria-label="History period">
      {periods.map((period) => (
        <button
          key={period}
          aria-pressed={value === period}
          onClick={() => onChange(period)}
        >
          {period}
        </button>
      ))}
    </div>
  )
}

export function PercentageChange({
  amount,
  percentage,
  currency,
}: {
  amount: string
  percentage: string | null
  currency: string
}) {
  const negative = amount.startsWith('-')
  return (
    <p className="period-change">
      <Money
        value={amount}
        currency={currency}
        tone={negative ? 'negative' : 'positive'}
        prefix={negative ? '' : '+'}
      />
      {percentage !== null && (
        <span className={negative ? 'negative' : 'positive'}>
          {' '}
          · {percentage.startsWith('-') ? '' : '+'}
          {percentage}%
        </span>
      )}
      <span className="metadata"> over selected period</span>
    </p>
  )
}

export function AccountRows({
  accounts,
  navigate,
  chevron = false,
}: {
  accounts: Account[]
  navigate: Navigate
  chevron?: boolean
}) {
  return (
    <>
      {!accounts.length && <EmptyState title="No accounts yet" />}
      {accounts.map((a) => (
        <button
          className="account-summary"
          aria-label={`Open ${a.name}`}
          key={a.id}
          onClick={() => navigate('Account', a.id)}
        >
          <span>
            <strong>{a.name}</strong>
            <small>
              {label(a.type)} · {a.currency}
              {!a.active && ' · Inactive'}
            </small>
          </span>
          <Money
            value={a.balance}
            currency={a.currency}
            tone={a.balance.startsWith('-') ? 'negative' : 'neutral'}
          />
          {chevron ? (
            <ChevronRight size={20} aria-hidden="true" />
          ) : (
            <ArrowRight size={14} aria-hidden="true" />
          )}
        </button>
      ))}
    </>
  )
}

export function SpendingList({ series }: { series: HistorySeries }) {
  return (
    <>
      {!series.spending.length && (
        <EmptyState title="No spending in this period" />
      )}
      {series.spending.slice(0, 6).map((row) => (
        <div className="spending-row" key={row.category_id ?? 'uncategorized'}>
          <div>
            <span>{row.name}</span>
            <Money value={row.amount} currency={series.currency} />
          </div>
          <div className="spending-track">
            <span
              style={{
                width: `${activityPercent(row.amount, series.expenses, '0')}%`,
              }}
            />
          </div>
        </div>
      ))}
    </>
  )
}

export function RecentActivity({
  rows,
  accounts,
  categories,
}: {
  rows: Transaction[]
  accounts: Account[]
  categories: Category[]
}) {
  return (
    <>
      {!rows.length && <EmptyState title="No transactions in this period" />}
      <ul className="activity-list">
        {rows.map((row) => {
          const transfer = row.transaction_type === 'TRANSFER'
          const tone =
            row.transaction_type === 'EXPENSE'
              ? 'negative'
              : row.transaction_type === 'INCOME'
                ? 'positive'
                : 'neutral'
          return (
            <li key={row.id}>
              <div>
                <strong>
                  {transfer && (
                    <ArrowLeftRight size={12} aria-label="Transfer" />
                  )}
                  {row.description}
                </strong>
                <p className="metadata">
                  {row.transaction_date} ·{' '}
                  {accounts.find((a) => a.id === row.account_id)?.name} ·{' '}
                  {transfer
                    ? `Transfer ${row.direction === 'IN' ? 'in' : 'out'}`
                    : (categories.find((c) => c.id === row.category_id)?.name ??
                      label(row.transaction_type))}
                </p>
              </div>
              <Money
                value={row.amount}
                currency={row.currency}
                tone={tone}
                prefix={
                  tone === 'positive' ? '+' : tone === 'negative' ? '−' : ''
                }
              />
            </li>
          )
        })}
      </ul>
    </>
  )
}
