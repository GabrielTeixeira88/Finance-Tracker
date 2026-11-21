// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 dashboard/{accounts-summary,top-holdings,goals}.tsx.
// Exact local API shapes replace numeric valuation hooks; no named portfolios.
import { Fragment, useState } from 'react'
import { ChevronRight, ListFilter } from 'lucide-react'
import { DashboardCard } from '@/components/dashboard-card'
import { EmptyState, Money } from '@/components/primitives'
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemFooter,
  ItemSeparator,
} from '@/vendor/wealthfolio/ui/components/ui/item'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/vendor/wealthfolio/ui/components/ui/popover'
import { Button } from '@/vendor/wealthfolio/ui/components/ui/button'
import { TickerAvatar, QuantityDisplay } from '@/features/holdings/formatting'
import type { Holding } from '@/features/holdings/types'
import type { GoalDetail } from '@/lib/wealth-api'
import { goalTimeLeft } from '@/lib/goal-display'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { decimalUnits, formatRatioPercent } from '@/lib/money'
import { t } from '@/lib/i18n'
import { Gain, Return } from './balance'
import type { Dashboard } from './api'

export function AccountsSummary({
  rows,
  currency,
  onOpen,
}: {
  rows: Dashboard['accounts']
  currency: string
  onOpen: (id: string) => void
}) {
  return (
    <section aria-label={t('dashboard_v014:accounts')}>
      <h2 className="text-sm font-semibold tracking-tight pb-2">
        {t('dashboard_v014:accounts')}
      </h2>
      {!rows.length ? (
        <EmptyState title={t('dashboard_v014:no_accounts')} />
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpen(item.id)}
              className="dashboard-account-row bg-card flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent/50 md:px-5 md:py-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-start md:gap-1.5">
                <h3 className="truncate text-sm leading-tight font-semibold md:text-base">
                  {item.name}
                </h3>
                <p className="text-muted-foreground truncate text-xs md:text-sm">
                  {item.currency}
                  {!item.active ? ` · ${t('dashboard_v014:inactive')}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:gap-3">
                <div className="flex min-h-12 flex-col items-end justify-center gap-1 md:gap-1.5">
                  <p className="text-sm leading-tight font-semibold md:text-base">
                    {item.value === null ? (
                      t('common:unavailable')
                    ) : (
                      <Money value={item.value} currency={currency} />
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs md:gap-2 md:text-sm">
                    <Gain value={item.gain.value} currency={currency} />
                    <span className="border-e h-3" />
                    <Return value={item.twr.value} />
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export function TopHoldings({
  holdings,
  onOpen,
  onViewAll,
}: {
  holdings: Holding[]
  onOpen: (id: string) => void
  onViewAll: () => void
}) {
  const [mode, setMode] = useState<
    'unrealized' | 'totalGain' | 'totalReturn' | 'dayChange'
  >('unrealized')
  const [sortBy, setSortBy] = useState<'value' | 'gain'>('value')
  const [display, setDisplay] = useState<'symbol' | 'name'>('symbol')
  const hidden = useFinancialPrivacy().hidden
  const gain = (row: Holding) =>
    mode === 'unrealized' ? row.unrealizedGain.local : row[mode].local
  const ratio = (row: Holding) =>
    mode === 'unrealized'
      ? row.unrealizedGainPct
      : mode === 'totalGain'
        ? row.totalGainPct
        : mode === 'totalReturn'
          ? row.totalReturnPct
          : row.dayChangePct
  const rows = holdings
    .filter((h) => h.holdingType === 'SECURITY' && !h.isClosed)
    .sort((a, b) => {
      // Never compare unrelated original currencies as though they were one amount.
      const currency = a.localCurrency.localeCompare(b.localCurrency)
      if (currency) return currency
      const x = sortBy === 'gain' ? gain(a) : a.marketValue.local,
        y = sortBy === 'gain' ? gain(b) : b.marketValue.local
      return x === null
        ? y === null
          ? a.id.localeCompare(b.id)
          : 1
        : y === null
          ? -1
          : decimalUnits(y) > decimalUnits(x)
            ? 1
            : decimalUnits(y) < decimalUnits(x)
              ? -1
              : a.id.localeCompare(b.id)
    })
  const count = rows.length === 8 ? 8 : 7
  return (
    <DashboardCard
      title={t('dashboard_v014:holdings')}
      action={
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={t('dashboard_v014:holding_filters')}
                />
              }
            >
              <ListFilter size={16} />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="dashboard-holding-menu min-w-50 rounded-2xl p-2"
            >
              <fieldset>
                <legend className="text-xs text-muted-foreground">
                  {t('dashboard_v014:metric')}
                </legend>
                {(
                  [
                    'unrealized',
                    'totalGain',
                    'totalReturn',
                    'dayChange',
                  ] as const
                ).map((value) => (
                  <label className="flex gap-2 p-2 text-sm" key={value}>
                    <input
                      type="radio"
                      name="holding-metric"
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    {t(`dashboard_v014:${value}`)}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend className="text-xs text-muted-foreground">
                  {t('dashboard_v014:sort')}
                </legend>
                {(['value', 'gain'] as const).map((value) => (
                  <label className="flex gap-2 p-2 text-sm" key={value}>
                    <input
                      type="radio"
                      name="holding-sort"
                      checked={sortBy === value}
                      onChange={() => setSortBy(value)}
                    />
                    {t(`dashboard_v014:${value}`)}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend className="text-xs text-muted-foreground">
                  {t('dashboard_v014:display')}
                </legend>
                {(['symbol', 'name'] as const).map((value) => (
                  <label className="flex gap-2 p-2 text-sm" key={value}>
                    <input
                      type="radio"
                      name="holding-display"
                      checked={display === value}
                      onChange={() => setDisplay(value)}
                    />
                    {t(`dashboard_v014:${value}`)}
                  </label>
                ))}
              </fieldset>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            {t('dashboard_v014:view_all')}
            <ChevronRight size={14} />
          </Button>
        </div>
      }
    >
      {!rows.length ? (
        <EmptyState title={t('dashboard_v014:no_holdings')} />
      ) : (
        rows.slice(0, count).map((row, index) => (
          <Fragment key={row.id}>
            {index > 0 && <ItemSeparator />}
            <Item
              size="sm"
              render={
                <button
                  onClick={() => row.instrument && onOpen(row.instrument.id)}
                />
              }
              className="-mx-2 w-[calc(100%+1rem)] flex-nowrap gap-3 border-0 px-2 text-start"
            >
              <TickerAvatar
                symbol={row.instrument?.symbol || row.id}
                className="h-10 w-10"
              />
              <ItemContent className="min-w-0 gap-0.5">
                <ItemTitle className="truncate text-sm font-semibold">
                  {display === 'symbol'
                    ? row.instrument?.symbol
                    : row.instrument?.name}
                </ItemTitle>
                <ItemDescription className="truncate text-xs">
                  <QuantityDisplay value={row.quantity} isHidden={hidden} /> ·{' '}
                  {row.localCurrency}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="shrink-0 flex-col items-end gap-1">
                <div className="text-sm font-semibold">
                  {row.marketValue.local === null ? (
                    t('common:unavailable')
                  ) : (
                    <Money
                      value={row.marketValue.local}
                      currency={row.localCurrency}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Gain value={gain(row)} currency={row.localCurrency} />
                  <span className="rounded-full bg-muted px-2">
                    {hidden
                      ? '••••'
                      : formatRatioPercent(ratio(row) ?? null, 1)}
                  </span>
                </div>
              </ItemActions>
            </Item>
          </Fragment>
        ))
      )}
      {rows.length > count && (
        <button
          className="flex w-full items-center justify-between pt-3 text-xs text-muted-foreground"
          onClick={onViewAll}
        >
          <span className="flex items-center">
            {rows.slice(count, count + 5).map((row, index) => (
              <span
                key={row.id}
                className={`relative ${index ? '-ms-2' : ''}`}
                style={{ zIndex: 5 - index }}
              >
                <TickerAvatar
                  symbol={row.instrument?.symbol || row.id}
                  className="h-8 w-8 ring-2 ring-card"
                />
              </span>
            ))}
          </span>
          <span>
            {t('dashboard_v014:more_holdings', { count: rows.length - count })}
          </span>
          <ChevronRight size={14} />
        </button>
      )}
      {new Set(rows.map((r) => r.localCurrency)).size > 1 && (
        <p className="metadata mt-2">
          {t('dashboard_v014:original_currencies')}
        </p>
      )}
    </DashboardCard>
  )
}

export function SavingGoals({
  goals,
  onOpen,
  onViewAll,
  asOf,
}: {
  goals: GoalDetail[]
  onOpen: (id: string) => void
  onViewAll: () => void
  asOf: string
}) {
  const privacy = useFinancialPrivacy()
  const rows = goals
    .filter((g) => g.goal.status === 'ACTIVE')
    .sort(
      (a, b) =>
        (a.goal.deadline || '9999').localeCompare(b.goal.deadline || '9999') ||
        a.goal.id.localeCompare(b.goal.id),
    )
  return (
    <DashboardCard
      title={t('dashboard_v014:goals')}
      action={
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          {t('dashboard_v014:view_all')}
          <ChevronRight size={14} />
        </Button>
      }
    >
      {!rows.length ? (
        <EmptyState title={t('dashboard_v014:no_goals')} />
      ) : (
        rows.slice(0, 5).map((row, index) => {
          const progress =
            row.progress === null ? null : decimalUnits(row.progress)
          const width =
            progress === null
              ? 0
              : Number(
                  progress < 0n
                    ? 0n
                    : progress > 1000000n
                      ? 1000000n
                      : progress,
                ) / 10000
          const offTrack = row.schedule_pace?.status === 'OFF_TRACK'
          return (
            <Fragment key={row.goal.id}>
              {index > 0 && <ItemSeparator />}
              <Item
                size="sm"
                render={<button onClick={() => onOpen(row.goal.id)} />}
                className="-mx-2 w-[calc(100%+1rem)] items-start gap-x-4 gap-y-2.5 border-0 px-2 text-start"
              >
                <ItemContent className="min-w-0 gap-0.5">
                  <ItemTitle className="w-full min-w-0 gap-2">
                    <h3 className="truncate text-sm leading-tight font-semibold md:text-base">
                      {row.goal.name}
                    </h3>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${offTrack ? 'bg-negative' : 'bg-positive'}`}
                    />
                  </ItemTitle>
                  <ItemDescription className="line-clamp-none text-xs tabular-nums md:text-sm">
                    {row.saved === null ? (
                      t('common:unavailable')
                    ) : (
                      <Money value={row.saved} currency={row.goal.currency} />
                    )}{' '}
                    /{' '}
                    <Money
                      value={row.goal.target}
                      currency={row.goal.currency}
                    />
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="shrink-0 flex-col items-end gap-1 text-end">
                  <div className="text-base leading-none font-semibold tabular-nums">
                    {privacy.hidden
                      ? '••••'
                      : formatRatioPercent(row.progress, 1)}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {row.goal.deadline
                      ? goalTimeLeft(row.goal.deadline, asOf)
                      : '—'}
                  </div>
                </ItemActions>
                <ItemFooter>
                  <div className="bg-muted/60 relative h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full ${offTrack ? 'bg-negative' : 'bg-positive'}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </ItemFooter>
              </Item>
            </Fragment>
          )
        })
      )}
      {rows.length > 5 && (
        <button
          className="flex w-full justify-between pt-3 text-xs text-muted-foreground"
          onClick={onViewAll}
        >
          {t('dashboard_v014:more_goals', { count: rows.length - 5 })}
          <ChevronRight size={14} />
        </button>
      )}
    </DashboardCard>
  )
}
