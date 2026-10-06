import type { ReactNode } from 'react'
import { Button } from './ui/button'
import { formatMoney } from '@/lib/money'

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <h1 tabIndex={-1} id="page-title">
          {title}
        </h1>
        {description && <p className="metadata">{description}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </header>
  )
}
export function SectionHeader({
  title,
  detail,
  children,
}: {
  title: string
  detail?: string
  children?: ReactNode
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {detail && <p className="metadata">{detail}</p>}
      </div>
      {children}
    </div>
  )
}
export function Panel({
  title,
  detail,
  children,
  className = '',
}: {
  title: string
  detail?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <SectionHeader title={title} detail={detail} />
      {children}
    </section>
  )
}
export function EmptyState({
  title,
  detail,
}: {
  title: string
  detail?: string
}) {
  return (
    <div className="empty">
      <p>{title}</p>
      {detail && <p className="metadata">{detail}</p>}
    </div>
  )
}
export function LoadingState({ text = 'Loading…' }: { text?: string }) {
  return (
    <p className="state" role="status">
      {text}
    </p>
  )
}
export function ErrorState({
  text,
  retry,
}: {
  text: string
  retry?: () => void
}) {
  return (
    <div role="alert" className="error state">
      {text}
      {retry && (
        <Button size="sm" variant="outline" onClick={retry}>
          Retry
        </Button>
      )}
    </div>
  )
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>
}
export function Money({
  value,
  currency,
  compact = false,
  tone = 'neutral',
  prefix = '',
}: {
  value: string
  currency: string
  compact?: boolean
  tone?: 'neutral' | 'positive' | 'negative'
  prefix?: string
}) {
  const exact = `${prefix}${formatMoney(value, currency)}`
  return (
    <span
      className={`money ${tone}`}
      title={`${exact} (${currency})`}
      aria-label={`${exact} ${currency}`}
    >
      {prefix}
      {formatMoney(value, currency, { compact })}
    </span>
  )
}
export function SummaryMetric({
  title,
  value,
  currency,
  detail,
  tone = 'neutral',
}: {
  title: string
  value: string
  currency: string
  detail: string
  tone?: 'neutral' | 'positive' | 'negative'
}) {
  return (
    <div className="summary-metric">
      <h2>{title}</h2>
      <div data-testid={title}>
        <Money value={value} currency={currency} tone={tone} />
      </div>
      <p className="metadata">{detail}</p>
    </div>
  )
}
