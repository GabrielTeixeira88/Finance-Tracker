import { t as tr, ui } from '@/lib/i18n'
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
import { activityPercent, formatExactPercent, formatDate } from '@/lib/money'
import type { Navigate } from './app-shell'
import { EmptyState, Money } from './primitives'
import { useId } from 'react'
import { SelectionIndicator } from './selection-indicator'

export function DateRangeTabs({
  value,
  onChange,
}: {
  value: Period
  onChange: (value: Period) => void
}) {
  const indicatorId = useId()
  return (
    <div
      className="range-tabs"
      role="group"
      aria-label={tr('financial:history_period_a0b9b7')}
    >
      {periods.map((period) => (
        <button
          key={ui(period)}
          aria-pressed={value === period}
          onClick={() => onChange(period)}
        >
          {value === period && (
            <SelectionIndicator id={`range-${indicatorId}`} />
          )}
          <span className="motion-choice-label">{ui(period)}</span>
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
          {formatExactPercent(percentage)}
        </span>
      )}
      <span className="metadata">
        {tr('financial:over_selected_period_c1f689')}
      </span>
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
      {!accounts.length && (
        <EmptyState title={tr('financial:no_accounts_yet_5c5d52')} />
      )}
      {accounts.map((a) => (
        <button
          className="account-summary"
          aria-label={tr('messages:message_4c1e7f5e5d70', { value0: a.name })}
          key={a.id}
          onClick={() => navigate('Account', a.id)}
        >
          <span>
            <strong>{a.name}</strong>
            <small>
              {label(a.type)} · {a.currency}
              {!a.active && tr('dynamic:_inactive_fe966d')}
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
        <EmptyState title={tr('financial:no_spending_in_this_period_ef27ca')} />
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
      {!rows.length && (
        <EmptyState
          title={tr('financial:no_transactions_in_this_period_b18c53')}
        />
      )}
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
                    <ArrowLeftRight
                      size={12}
                      aria-label={tr('financial:transfer_cbb4cc')}
                    />
                  )}
                  {row.payee?.name ?? row.description}
                </strong>
                <p className="metadata">
                  {formatDate(row.transaction_date)} ·{' '}
                  {accounts.find((a) => a.id === row.account_id)?.name} ·{' '}
                  {row.refund_purchase_id
                    ? tr('dynamic:refund_e17c8a')
                    : transfer
                      ? tr('messages:message_3c8c23023b21', {
                          value0: ui(row.direction === 'IN' ? 'in' : 'out'),
                        })
                      : (categories.find((c) => c.id === row.category_id)
                          ?.name ?? label(row.transaction_type))}
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
