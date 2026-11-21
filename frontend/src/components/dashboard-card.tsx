// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647, apps/frontend/src/components/dashboard-card.tsx.
// Local semantic surface replaces @wealthfolio/ui Card; API/state remain local.
import type { ReactNode } from 'react'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'

export function DashboardCard({
  title,
  subtitle,
  action,
  meta,
  className = '',
  children,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  meta?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`financial-dashboard-card ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle && <span className="metadata">{subtitle}</span>}
        </div>
        {(action || meta) && (
          <div className="ms-auto">
            {action ?? <span className="dashboard-card-meta">{meta}</span>}
          </div>
        )}
      </header>
      <Card className="dashboard-card-body p-3 md:p-4">{children}</Card>
    </section>
  )
}
