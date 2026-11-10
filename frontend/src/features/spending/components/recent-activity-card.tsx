// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 recent-activity-card.tsx, source list JSX with local classifications.
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { Transaction, Category, Account } from '@/lib/api'
import { Link } from '../compat'
import {
  PrivacyAmount,
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
  useDateFormatting,
} from '../ui'
import { DashboardCard } from './dashboard-card'
import { CategoryBadge } from './category-chips'
export function RecentActivityCard({
  activities,
  categories,
  accounts,
  href,
}: {
  activities: Transaction[]
  categories: Category[]
  accounts: Account[]
  href: string
}) {
  const { t } = useTranslation(),
    dates = useDateFormatting()
  const grouped = new Map<string, Transaction[]>()
  for (const row of activities)
    grouped.set(row.transaction_date, [
      ...(grouped.get(row.transaction_date) ?? []),
      row,
    ])
  return (
    <DashboardCard
      title={t('wfSpending:dashboard.recentActivity')}
      padded={false}
      className="overflow-hidden"
      action={
        <Link
          to={href}
          className="text-muted-foreground hover:text-foreground text-xs hover:underline"
        >
          {t('wfSpending:dashboard.viewAll')}
        </Link>
      }
    >
      {!activities.length ? (
        <p className="text-muted-foreground px-4 py-6 text-center text-xs">
          {t('wfSpending:dashboard.noRecentActivity')}
        </p>
      ) : (
        [...grouped].map(([date, items], index) => (
          <div
            key={date}
            className={cn(
              'px-4 py-3 md:px-5',
              index > 0 && 'border-border/60 border-t',
            )}
          >
            <div className="text-muted-foreground/70 text-2xs font-semibold tracking-wide uppercase">
              {dates.formatCalendarDate(date)}
            </div>
            {items.map((row) => {
              const category = categories.find(
                (cat) =>
                  cat.id === (row.spending_category_id ?? row.category_id),
              )
              const outflow = row.transaction_type === 'EXPENSE'
              return (
                <Item
                  key={row.id}
                  size="xs"
                  render={
                    <Link
                      to={
                        href +
                        '&q=' +
                        encodeURIComponent(row.payee?.name ?? row.description)
                      }
                    />
                  }
                  className="-mx-2 flex-nowrap border-0 px-2 py-1.5"
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle className="text-foreground/90 block w-full truncate text-xs font-medium">
                      {row.payee?.name ?? row.description}
                    </ItemTitle>
                    <span className="text-muted-foreground text-2xs">
                      {accounts.find((a) => a.id === row.account_id)?.name}
                    </span>
                  </ItemContent>
                  <ItemActions className="shrink-0 gap-2.5">
                    {category ? (
                      <CategoryBadge
                        name={category.name}
                        color={category.color ?? null}
                        icon={category.icon ?? null}
                      />
                    ) : (
                      <span className="text-muted-foreground text-2xs">
                        {t('wfSpending:dashboard.uncategorized')}
                      </span>
                    )}
                    <div
                      className={cn(
                        'shrink-0 text-xs font-semibold tabular-nums',
                        outflow ? 'text-foreground' : 'text-success',
                      )}
                    >
                      {outflow ? '−' : '+'}
                      <PrivacyAmount
                        value={row.amount}
                        currency={row.currency}
                      />
                    </div>
                  </ItemActions>
                </Item>
              )
            })}
          </div>
        ))
      )}
    </DashboardCard>
  )
}
