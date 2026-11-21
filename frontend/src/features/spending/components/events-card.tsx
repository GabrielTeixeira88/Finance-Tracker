// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 events-card.tsx, original event card render; authoritative local event report adapter.
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getEvents } from '@/lib/life-events'
import { cn } from '@/lib/utils'
import { decimalUnits, unitsToMoney } from '@/lib/money'
import type { Category } from '@/lib/api'
import { Link } from '../compat'
import { Icons, PrivacyAmount, useDateFormatting } from '../ui'
import { CategoryIcon } from './category-chips'
import { ErrorState, LoadingState } from '@/components/primitives'
export function EventsCard({
  asOf,
  start,
  end,
  categories,
}: {
  asOf: string
  start: string
  end: string
  categories: Category[]
}) {
  const { t } = useTranslation(),
    dates = useDateFormatting()
  const query = useQuery({ queryKey: ['life-events'], queryFn: getEvents })
  if (query.isPending) return <LoadingState />
  if (query.isError)
    return (
      <ErrorState
        text={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  const selected = query.data
    .filter((row) => row.event.start_date <= end && row.event.end_date >= start)
    .sort((a, b) => b.event.start_date.localeCompare(a.event.start_date))[0]
  const eventHref =
    '/dashboard?view=spending&detail=insights&stage=when' +
    (selected ? '&event=' + selected.event.id : '')
  if (!selected)
    return (
      <Link
        to={eventHref}
        className="text-muted-foreground text-xs hover:underline"
      >
        {t('wfSpending:tabContent.digDeeper')} �{' '}
        {t('wfSpending:insights.stageWhen')}
      </Link>
    )
  if (selected.actual_cost === null)
    return (
      <div className="border-border/40 bg-card/70 rounded-xl border p-4">
        <Link to={eventHref}>{selected.event.name}</Link>
        <p>{t('common:unavailable')}</p>
      </div>
    )
  const event = selected.event,
    ev = { eventName: event.name, transactionCount: selected.transaction_count }
  const totalDays =
    Math.round(
      (Date.parse(event.end_date) - Date.parse(event.start_date)) / 86400000,
    ) + 1
  const pick: { mode: string; days: number } = {
    mode:
      event.start_date > asOf
        ? 'upcoming'
        : event.end_date < asOf
          ? 'recent'
          : 'period',
    days: Math.max(
      0,
      Math.round((Date.parse(event.start_date) - Date.parse(asOf)) / 86400000),
    ),
  }
  const eventSpent = selected.actual_cost,
    dailyAvg = unitsToMoney(decimalUnits(eventSpent) / BigInt(totalDays))
  const currency = event.currency,
    theme = { deep: 'var(--spending-deep)' }
  const themeBg = (_theme: unknown, opacity: number) =>
    `color-mix(in oklab, var(--spending-deep) ${opacity * 100}%, transparent)`
  const dateRangeLabel =
    dates.formatCalendarDate(event.start_date) +
    ' � ' +
    dates.formatCalendarDate(event.end_date)
  const HeaderIcon = Icons.Calendar,
    tag = event.event_type,
    subLine = ''
  const compareMultiple = 0 // No cross-period event baseline is claimed.
  const topCategories = selected.categories
    .slice()
    .sort((a, b) => (decimalUnits(a.value) > decimalUnits(b.value) ? -1 : 1))
    .slice(0, 3)
    .map((row) => ({
      name: row.name,
      amount: row.value,
      color: categories.find((c) => c.id === row.id)?.color ?? null,
      icon: categories.find((c) => c.id === row.id)?.icon ?? null,
    }))
  return (
    <div className="border-border/40 bg-card/70 rounded-xl border p-4 backdrop-blur-xl md:p-5">
      <div className="flex items-center gap-2">
        <HeaderIcon
          className="h-4 w-4 shrink-0"
          style={{ color: theme.deep }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-sm font-semibold">
            {ev!.eventName}
          </div>
          <div className="text-muted-foreground/70 text-2xs">
            {dateRangeLabel}
          </div>
        </div>
        <span
          className="text-2xs rounded-full px-1.5 py-0.5 font-bold tracking-wide"
          style={{ backgroundColor: themeBg(theme, 0.2), color: theme.deep }}
        >
          {tag}
        </span>
      </div>

      {pick.mode === 'upcoming' && decimalUnits(eventSpent) <= 0n ? (
        <div className="mt-3">
          <div className="text-foreground text-2xl font-bold tracking-tight tabular-nums">
            {t('wfSpending:eventsCard.daysValue', { count: pick.days })}
          </div>
          <div className="text-muted-foreground/80 text-xs">
            {t('wfSpending:eventsCard.untilPlanned', {
              name: ev!.eventName,
              planned: t('wfSpending:eventsCard.daysPlanned', {
                count: totalDays,
              }),
            })}
          </div>
        </div>
      ) : decimalUnits(eventSpent) > 0n ? (
        <>
          <div className="mt-3">
            <div className="text-foreground text-2xl font-bold tracking-tight tabular-nums">
              <PrivacyAmount value={eventSpent} currency={currency} />
            </div>
            <div className="text-muted-foreground/80 text-xs">
              {pick.mode === 'recent'
                ? t('wfSpending:eventsCard.total')
                : t('wfSpending:eventsCard.spentSoFar')}{' '}
              ·{' '}
              {t('wfSpending:eventsCard.transactionCount', {
                count: ev!.transactionCount,
              })}
              {subLine && (
                <>
                  {' · '}
                  {subLine}
                </>
              )}
            </div>
          </div>

          <div className="border-border/40 text-muted-foreground/80 text-2xs mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2">
            <span className="tabular-nums">
              <span className="text-foreground/90 font-semibold">
                <PrivacyAmount value={dailyAvg} currency={currency} />
              </span>{' '}
              {t('wfSpending:eventsCard.perDay')}
            </span>
            {compareMultiple > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span
                  className={cn(
                    'tabular-nums',
                    compareMultiple >= 1.25
                      ? 'text-destructive'
                      : compareMultiple >= 0.85
                        ? 'text-muted-foreground/80'
                        : 'text-success',
                  )}
                >
                  {compareMultiple >= 1 ? '↑' : '↓'}{' '}
                  {t('wfSpending:eventsCard.vsTypical', {
                    multiple: String(compareMultiple),
                    days: totalDays,
                  })}
                </span>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="text-muted-foreground/80 mt-3 text-xs">
          {subLine || t('wfSpending:eventsCard.noTaggedYet')}
        </div>
      )}

      {decimalUnits(eventSpent) > 0n && topCategories.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground/60 text-2xs font-semibold tracking-wide uppercase">
            {t('wfSpending:eventsCard.top')}
          </span>
          {topCategories.map((c) => {
            const accent = c.color ?? theme.deep
            return (
              <span
                key={c.name}
                className="text-2xs inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium tabular-nums"
                style={{
                  backgroundColor: c.color
                    ? `${c.color}1F`
                    : themeBg(theme, 0.12),
                  color: accent,
                }}
              >
                <CategoryIcon
                  icon={c.icon}
                  fallback={c.name}
                  className="h-3.5 w-3.5"
                />
                <span className="text-foreground/85">{c.name}</span>
                <span className="opacity-70">
                  <PrivacyAmount value={c.amount} currency={currency} />
                </span>
              </span>
            )
          })}
        </div>
      )}

      {pick.mode === 'upcoming' && decimalUnits(eventSpent) <= 0n ? (
        <button
          type="button"
          onClick={() => {
            const start = new Date(asOf + 'T12:00:00')
            start.setDate(start.getDate() + 7)
            window.location.hash = eventHref
          }}
          className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
        >
          {t('wfSpending:eventsCard.planEvent')}
          <Icons.ChevronRight className="h-3 w-3 rtl:rotate-180" />
        </button>
      ) : (
        <Link
          to={eventHref}
          className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
        >
          {pick.mode === 'recent'
            ? t('wfSpending:eventsCard.seeBreakdown')
            : t('wfSpending:eventsCard.openEvent')}
          <Icons.ChevronRight className="h-3 w-3 rtl:rotate-180" />
        </Link>
      )}
    </div>
  )
}
