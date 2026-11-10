import { EventDailyChart } from '@/components/event-daily-chart'
// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 event-detail-panel.tsx: source detail/summary/chart/rhythm JSX and interactions.
// Exact local event associations and recorded spending history replace provider hooks.
import type { TFunction } from 'i18next'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { EventReport } from '@/lib/life-events'
import { cn } from '@/lib/utils'
import { decimalUnits, subtractMoney, formatDecimal } from '@/lib/money'
import { dayAfter } from '@/lib/spending-period'
import { useWrite } from '@/lib/use-write'
import { getSpendingWorkspace } from '../../../api'
import { eventDetailProjection } from '../../../lib/event-detail'
import {
  sourceEvents,
  getEventTypeLabel,
  parseLocalDate,
  calendarDateFromLocalDate,
  useDateFormatting,
  type FormattingApi,
} from '../../../lib/event-adapter'
import {
  exactAbs,
  safePercent,
  exactRatio,
  useBalancePrivacy,
} from '../../../compat'
import {
  Button,
  Icons,
  PrivacyAmount,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useAmountFormatting,
  useNumberFormatting,
  useIsMobile,
  badgeVariants,
} from '../../../ui'
import { getEventColors } from './event-colors'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'
import { ErrorState, LoadingState } from '@/components/primitives'
const CARD_CLASS = 'p-5',
  LABEL_CLASS = 'text-muted-foreground/70 text-2xs uppercase tracking-[0.12em]'
export function EventDetailPanel({
  report: r,
  reports,
  onSelect,
  onEdit,
  onLink,
}: {
  report: EventReport
  reports: EventReport[]
  onSelect: (id: string) => void
  onEdit: () => void
  onLink: () => void
}) {
  const { t } = useTranslation(),
    { isBalanceHidden } = useBalancePrivacy(),
    isPhone = useIsMobile(),
    formatting = useAmountFormatting(),
    dateFormatting = useDateFormatting(),
    numberFormatting = useNumberFormatting()
  const currency = r.event.currency,
    update = useWrite(),
    fullEvent = r.event
  const history = useQuery({
    queryKey: ['spending-workspace', 'event-detail', r.event.id, r.as_of],
    queryFn: ({ signal }) =>
      getSpendingWorkspace(
        dayAfter(r.event.start_date, -7) < '1900-01-01'
          ? '1900-01-01'
          : dayAfter(r.event.start_date, -7),
        dayAfter(r.event.end_date, 4) < dayAfter(r.as_of)
          ? dayAfter(r.event.end_date, 4)
          : dayAfter(r.as_of),
        r.as_of,
        currency,
        signal,
      ),
    enabled: r.event.start_date <= r.as_of,
  })
  const chart = eventDetailProjection(r, history.data)
  const {
    startDate,
    endDate,
    days,
    dailyDuring,
    baseline,
    expected,
    lift,
    dailyDeltaPct,
    dailySeries,
    tagged,
    peak,
    beforeSeries,
    afterSeries,
    beforeAvg,
    afterAvg,
    hangoverPct,
    outOfRange,
  } = chart
  const events = sourceEvents(
      reports.filter((row) => row.event.currency === currency),
    ),
    event = sourceEvents([r])[0]
  const categories = r.categories
    .map((row) => ({
      id: row.id ?? 'none',
      name: row.name,
      amount: row.value,
      color: 'var(--spending-deep)',
    }))
    .sort((a, b) => (decimalUnits(a.amount) > decimalUnits(b.amount) ? -1 : 1))
  const categoriesTotal = r.actual_cost ?? '0'
  const currentIdx = events.findIndex((row) => row.eventId === event.eventId),
    canNav = events.length > 1
  const prevEvent = canNav
      ? events[(currentIdx - 1 + events.length) % events.length]
      : null,
    nextEvent = canNav ? events[(currentIdx + 1) % events.length] : null
  const tagColor = event.eventTypeColor ?? 'var(--spending-deep)'
  const handleEdit = onEdit,
    handleViewTransactions = onLink
  const expandWindow = () => {
    const dates = [r.event.start_date, r.event.end_date, ...outOfRange].sort()
    if (window.confirm(t('spendingMigration:confirmEventRange')))
      update.mutate({
        path: '/life-events/' + r.event.id,
        method: 'PATCH',
        data: { ...r.event, start_date: dates[0], end_date: dates.at(-1) },
      })
  }
  const caption = buildEventCaption({
    days,
    lift,
    currency,
    top: categories,
    isBalanceHidden,
    t,
    formatting: dateFormatting,
  })
  if (history.isPending && r.event.start_date <= r.as_of)
    return <LoadingState />
  if (history.isError)
    return (
      <ErrorState
        text={history.error.message}
        retry={() => void history.refetch()}
      />
    )
  return (
    <Card className={CARD_CLASS}>
      {/* HEADER */}
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{
                background: `${tagColor}26`,
                border: `1.5px solid ${tagColor}`,
              }}
            />
            <div className="text-foreground truncate text-base font-semibold tracking-tight">
              {event.eventName}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t('wfSpending:eventDetail.previousEvent')}
                    className="h-7 w-7"
                    onClick={() => prevEvent && onSelect(prevEvent.eventId)}
                    disabled={!canNav}
                  />
                }
              >
                <Icons.ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </TooltipTrigger>
              <TooltipContent>
                {t('wfSpending:eventDetail.previousEvent')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t('wfSpending:eventDetail.nextEvent')}
                    className="h-7 w-7"
                    onClick={() => nextEvent && onSelect(nextEvent.eventId)}
                    disabled={!canNav}
                  />
                }
              >
                <Icons.ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </TooltipTrigger>
              <TooltipContent>
                {t('wfSpending:eventDetail.nextEvent')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t('wfSpending:eventDetail.editEvent')}
                    className="h-7 w-7"
                    onClick={handleEdit}
                    disabled={!fullEvent}
                  />
                }
              >
                <Icons.Pencil className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                {t('wfSpending:eventDetail.editEvent')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t(
                      'wfSpending:eventDetail.tagTransactionsInPeriod',
                    )}
                    className="h-7 w-7"
                    onClick={handleViewTransactions}
                  />
                }
              >
                <Icons.Activity className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                {t('wfSpending:eventDetail.tagTransactions')}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="text-muted-foreground/80 text-2xs mt-1">
          {formatRange(startDate, endDate, dateFormatting)} ·{' '}
          {t('wfSpending:eventDetail.daysCount', { count: days })} ·{' '}
          {t('wfSpending:eventDetail.transactionCount', {
            count: event.transactionCount,
          })}
          {event.eventTypeName
            ? ` · ${getEventTypeLabel(t, event.eventTypeId, event.eventTypeName)}`
            : ''}
        </div>
      </div>

      {outOfRange.length > 0 && (
        <div className="bg-warning/10 border-warning/40 text-2xs mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-1.5">
          <span className="text-foreground/90">
            {t('wfSpending:eventDetail.taggedOutside', {
              count: outOfRange.length,
            })}
            <span className="text-muted-foreground/80 ms-1 tabular-nums">
              ({formatOutOfRangeDate(outOfRange[0], dateFormatting)}
              {outOfRange.length > 1
                ? `–${formatOutOfRangeDate(outOfRange[outOfRange.length - 1], dateFormatting)}`
                : ''}
              )
            </span>
          </span>
          <button
            type="button"
            onClick={expandWindow}
            disabled={update.isPending}
            className="text-foreground hover:bg-warning-subtle text-2xs rounded px-2 py-0.5 font-medium underline-offset-2 hover:underline disabled:opacity-50"
          >
            {update.isPending
              ? t('wfSpending:eventDetail.expanding')
              : t('wfSpending:eventDetail.expandWindow')}
          </button>
        </div>
      )}

      {/* STAT BLOCK */}
      <div className="mt-2 grid grid-cols-2 gap-y-3 md:grid-cols-4 md:gap-x-0 md:gap-y-4">
        <StatCell label={t('wfSpending:eventDetail.eventTotal')}>
          <div className="text-foreground text-sm font-semibold tracking-tight tabular-nums md:text-base">
            <PrivacyAmount value={event.totalSpending} currency={currency} />
          </div>
          <div className="text-muted-foreground/80 text-2xs mt-1">
            {t('wfSpending:eventDetail.acrossTransactions', {
              count: event.transactionCount,
            })}
          </div>
        </StatCell>
        <StatCell
          label={
            isPhone
              ? t('wfSpending:eventDetail.liftShort')
              : t('wfSpending:eventDetail.liftVsNormal')
          }
          divided
        >
          <div
            className={cn(
              'text-sm font-semibold tabular-nums tracking-tight md:text-base',
              decimalUnits(lift ?? '0') >= 0n
                ? 'text-destructive'
                : 'text-success',
            )}
          >
            {lift === null ? '' : decimalUnits(lift) >= 0n ? '+' : '−'}
            <PrivacyAmount
              value={lift === null ? null : exactAbs(lift)}
              currency={currency}
            />
          </div>
          <div className="text-muted-foreground/80 text-2xs mt-1">
            {t('wfSpending:eventDetail.vsLabel')}{' '}
            <PrivacyAmount value={expected} currency={currency} />{' '}
            {t('wfSpending:eventDetail.expected')}
          </div>
        </StatCell>
        <StatCell
          label={
            isPhone
              ? t('wfSpending:eventDetail.dailyShort')
              : t('wfSpending:eventDetail.dailyDuring')
          }
          divided
        >
          <div className="text-foreground text-sm font-semibold tracking-tight tabular-nums md:text-base">
            <PrivacyAmount value={dailyDuring} currency={currency} />
          </div>
          <div className="text-muted-foreground/80 text-2xs mt-1">
            {decimalUnits(baseline ?? '0') > 0n
              ? t('wfSpending:eventDetail.dailyDeltaVs', {
                  sign: decimalUnits(dailyDeltaPct ?? '0') >= 0n ? '+' : '−',
                  pct:
                    dailyDeltaPct === null
                      ? '—'
                      : formatDecimal(exactAbs(dailyDeltaPct)),
                  baseline: isBalanceHidden
                    ? '••••'
                    : formatting.formatAmount(baseline, currency),
                })
              : t('wfSpending:eventDetail.noBaseline')}
          </div>
        </StatCell>
        <StatCell label={t('wfSpending:eventDetail.peakDay')} divided>
          <div className="text-foreground text-sm font-semibold tracking-tight tabular-nums md:text-base">
            {peak ? (
              <PrivacyAmount value={peak.amount} currency={currency} />
            ) : (
              '—'
            )}
          </div>
          <div className="text-muted-foreground/80 text-2xs mt-1">
            {peak ? formatPeakDay(peak.date, dateFormatting) : ''}
          </div>
        </StatCell>
      </div>

      {/* TAKEAWAY */}
      <p className="text-foreground/90 mt-6 text-sm leading-relaxed">
        <span className="text-primary text-2xs me-2 font-semibold tracking-[0.12em] uppercase">
          {t('wfSpending:eventDetail.takeaway')}
        </span>
        {caption}
      </p>

      {/* DAY BY DAY · WHAT DROVE IT */}
      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        {/* LEFT: DAY BY DAY */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className={LABEL_CLASS}>
              {t('wfSpending:eventDetail.dayByDay')}
            </div>
            <div className={cn(LABEL_CLASS, 'text-end')}>
              {isBalanceHidden
                ? `${t('wfSpending:eventDetail.baseline')} ••••${peak ? ` · ${t('wfSpending:eventDetail.peak')} ••••` : ''}`
                : isPhone
                  ? `${t('wfSpending:eventDetail.baseline')} ${formatting.formatCompactAmount(baseline, currency)}`
                  : peak
                    ? `${t('wfSpending:eventDetail.peak')} ${formatting.formatAmount(peak.amount, currency)} · ${t('wfSpending:eventDetail.baseline')} ${formatting.formatAmount(baseline, currency)}`
                    : `${t('wfSpending:eventDetail.baseline')} ${formatting.formatAmount(baseline, currency)}`}
            </div>
          </div>
          <DailyBars
            series={tagged.series}
            inWindow={tagged.inWindow}
            chartStartDate={tagged.chartStartDate}
            chartEndDate={tagged.chartEndDate}
            eventDays={days}
            baseline={baseline}
            currency={currency}
            compact={isPhone}
            isBalanceHidden={isBalanceHidden}
            t={t}
          />
        </div>

        {/* RIGHT: WHAT DROVE IT */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className={LABEL_CLASS}>
              {t('wfSpending:eventDetail.whatDroveIt')}
            </div>
            <div className={cn(LABEL_CLASS, 'text-end')}>
              {t('wfSpending:eventDetail.categoriesCount', {
                count: categories.length,
              })}
            </div>
          </div>
          {categories.length > 0 && (
            <>
              {!categories.some((row) => decimalUnits(row.amount) < 0n) &&
                r.complete && (
                  <div className="mt-3 flex h-1.5 items-stretch gap-0.5">
                    {categories.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-full"
                        title={`${c.name} · ${
                          isBalanceHidden
                            ? '••••'
                            : formatting.formatAmount(c.amount, currency)
                        }`}
                        style={{
                          flex: `${safePercent(c.amount, categoriesTotal)} 0 0`,
                          background: c.color,
                        }}
                      />
                    ))}
                  </div>
                )}
              <div className="mt-2">
                {categories.map((c) => {
                  const pct = exactRatio(c.amount, categoriesTotal)
                  return (
                    <div
                      key={c.id}
                      className="border-border/30 flex items-center gap-3 border-b py-1.5 last:border-b-0"
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: c.color }}
                      />
                      <span className="text-foreground/90 min-w-0 flex-1 truncate text-xs">
                        {c.name}
                      </span>
                      <span className="text-muted-foreground/80 text-2xs tabular-nums">
                        {numberFormatting.formatPercent(pct, { digits: 1 })}
                      </span>
                      <span className="text-foreground/90 text-end text-xs font-medium tabular-nums">
                        <PrivacyAmount value={c.amount} currency={currency} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <Hr />

      {/* AFTER */}
      <SubLabel
        right={
          isPhone
            ? t('wfSpending:eventDetail.dayWindowShort', { days })
            : t('wfSpending:eventDetail.dayWindow', { days })
        }
      >
        {isPhone
          ? t('wfSpending:eventDetail.after')
          : t('wfSpending:eventDetail.afterRhythm')}
      </SubLabel>
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <RhythmCard
          label={t('wfSpending:eventDetail.before7d')}
          value={beforeAvg}
          currency={currency}
          series={beforeSeries}
          accent="muted"
        />
        <RhythmCard
          label={t('wfSpending:eventDetail.during')}
          value={dailyDuring}
          currency={currency}
          series={dailySeries}
          accent="during"
        />
        <RhythmCard
          label={t('wfSpending:eventDetail.after3d')}
          value={afterAvg}
          currency={currency}
          series={afterSeries}
          accent={
            decimalUnits(hangoverPct ?? '0') > 5000000n
              ? 'warn'
              : decimalUnits(hangoverPct ?? '0') < -5000000n
                ? 'good'
                : 'muted'
          }
          hangoverPct={afterSeries.length > 0 ? hangoverPct : undefined}
        />
      </div>

      <Hr />

      {/* JUMP TO */}
      <SubLabel>{t('wfSpending:eventDetail.jumpTo')}</SubLabel>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {events.map((ev) => {
          const c = getEventColors(ev)
          const isSel = ev.eventId === event.eventId
          return (
            <button
              key={ev.eventId}
              type="button"
              onClick={() => onSelect(ev.eventId)}
              className={cn(
                'text-2xs inline-flex items-center gap-2 rounded-full border px-3 py-1 transition-colors',
                isSel
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
              )}
              style={{
                background: isSel ? c.fill : 'transparent',
                borderColor: isSel ? c.stroke : 'transparent',
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-[2px]"
                style={{
                  background: c.fill,
                  border: `1.5px solid ${c.stroke}`,
                }}
              />
              {ev.eventName}
              <span className="text-muted-foreground/80 ms-1">
                · {formatChipDate(parseLocalDate(ev.startDate), dateFormatting)}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Subcomponents ───────────────────────────────────────────────────────

function StatCell({
  label,
  divided,
  children,
}: {
  label: string
  divided?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn(divided && 'md:border-border/40 md:border-s md:ps-4')}>
      <div className={LABEL_CLASS}>{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function SubLabel({
  children,
  right,
}: {
  children: React.ReactNode
  right?: string
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <div className={LABEL_CLASS}>{children}</div>
      {right ? (
        <div className={cn(LABEL_CLASS, 'text-end')}>{right}</div>
      ) : null}
    </div>
  )
}

function Hr() {
  return <div className="bg-border/40 my-5 h-px" />
}

function DailyBars({
  series,
  inWindow,
  chartStartDate,
  chartEndDate,
  eventDays,
  baseline,
  currency,
  compact,
  isBalanceHidden,
  t,
}: {
  isBalanceHidden: boolean
  series: string[]
  inWindow: boolean[]
  chartStartDate: Date
  chartEndDate: Date
  eventDays: number
  baseline: string | null
  currency: string
  compact?: boolean
  t: TFunction
}) {
  const formatting = useAmountFormatting()
  const dateFormatting = useDateFormatting()
  const max = [baseline ?? '0', ...series.map(exactAbs)].reduce(
    (high, value) => (decimalUnits(value) > decimalUnits(high) ? value : high),
    '0',
  )
  const hasOutOfWindow = inWindow.some((v) => !v)
  if (!series.length)
    return (
      <p className="text-muted-foreground py-4 text-xs">
        {t('common:unavailable')}
      </p>
    )
  if (series.some((value) => decimalUnits(value) < 0n))
    return (
      <EventDailyChart
        currency={currency}
        points={series.map((value, index) => ({
          date: dayAfter(
            chartStartDate.getFullYear() +
              '-' +
              String(chartStartDate.getMonth() + 1).padStart(2, '0') +
              '-' +
              String(chartStartDate.getDate()).padStart(2, '0'),
            index,
          ),
          value,
        }))}
      />
    )

  return (
    <div className="mt-3">
      <div
        className={cn(
          'relative flex items-end gap-[3px]',
          compact ? 'h-20' : 'h-28',
        )}
      >
        {decimalUnits(baseline ?? '0') > 0n && (
          <div
            className="border-foreground/30 pointer-events-none absolute start-0 end-0 border-t border-dashed"
            style={{ bottom: `${safePercent(baseline ?? '0', max) * 100}%` }}
          />
        )}
        {series.map((v, i) => {
          const isOut = !inWindow[i]
          const boundary = i > 0 && inWindow[i - 1] !== inWindow[i]
          const bar = (
            <div
              key={`bar-${i}`}
              className={cn(
                'min-w-[2px] flex-1 rounded-t-[2px]',
                isOut ? 'bg-warning/70' : 'bg-success/80',
              )}
              style={{ height: `${safePercent(exactAbs(v), max) * 100}%` }}
              title={
                (isBalanceHidden
                  ? '••••'
                  : formatting.formatAmount(v, currency)) +
                (isOut ? ` · ${t('wfSpending:eventDetail.outsideWindow')}` : '')
              }
            />
          )
          if (!boundary) return bar
          return [
            <div
              key={`sep-${i}`}
              className="bg-foreground/40 -my-1 w-px self-stretch"
              aria-hidden
            />,
            bar,
          ]
        })}
      </div>
      <div className="text-muted-foreground/80 text-2xs mt-2 flex items-center justify-between tracking-wide">
        <span className="tabular-nums">
          {formatPeakDay(chartStartDate, dateFormatting)}
        </span>
        <span className="text-muted-foreground/60">
          {t('wfSpending:eventDetail.daysCount', { count: eventDays })}
          {hasOutOfWindow
            ? ` · ${t('wfSpending:eventDetail.inclOutside')}`
            : ''}
        </span>
        <span className="tabular-nums">
          {formatPeakDay(chartEndDate, dateFormatting)}
        </span>
      </div>
    </div>
  )
}

type RhythmAccent = 'muted' | 'during' | 'warn' | 'good'

function RhythmCard({
  label,
  value,
  currency,
  series,
  accent,
  hangoverPct,
}: {
  label: string
  value: string | null
  currency: string
  series: string[]
  accent: RhythmAccent
  hangoverPct?: string | null
}) {
  const { t } = useTranslation()
  const palette = {
    muted: {
      bg: 'bg-muted/20',
      border: 'border-border/40',
      stroke: 'var(--muted-foreground)',
      fill: null as string | null,
    },
    during: {
      bg: 'bg-success/10',
      border: 'border-success/30',
      stroke: 'var(--success)',
      fill: 'var(--success)',
    },
    warn: {
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      stroke: 'var(--destructive)',
      fill: null as string | null,
    },
    good: {
      bg: 'bg-success/10',
      border: 'border-success/30',
      stroke: 'var(--success)',
      fill: null as string | null,
    },
  }[accent]

  return (
    <div
      className={cn('rounded-md border px-3 py-2', palette.bg, palette.border)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className={LABEL_CLASS}>{label}</div>
        {hangoverPct !== null &&
          hangoverPct !== undefined &&
          decimalUnits(exactAbs(hangoverPct)) > 5000000n && (
            <span
              className={cn(
                badgeVariants({
                  variant:
                    decimalUnits(hangoverPct ?? '0') > 0n
                      ? 'destructive-subtle'
                      : 'success-subtle',
                }),
                'text-2xs rounded-sm px-1 font-normal tracking-wider',
              )}
            >
              {decimalUnits(hangoverPct ?? '0') > 0n
                ? t('wfSpending:eventDetail.hangover', {
                    pct:
                      hangoverPct === null ? null : formatDecimal(hangoverPct),
                  })
                : t('wfSpending:eventDetail.under', {
                    pct: formatDecimal(exactAbs(hangoverPct)),
                  })}
            </span>
          )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-foreground text-sm font-medium tabular-nums">
          {series.length === 0 ? (
            '—'
          ) : (
            <>
              <PrivacyAmount value={value} currency={currency} />
              <span className="text-muted-foreground/70 font-normal">
                {t('wfSpending:eventDetail.perDayShort')}
              </span>
            </>
          )}
        </span>
        {series.length > 0 && (
          <Sparkline
            data={series}
            stroke={palette.stroke}
            fill={palette.fill}
          />
        )}
      </div>
    </div>
  )
}

function Sparkline({
  data,
  stroke,
  fill,
}: {
  data: string[]
  stroke: string
  fill: string | null
}) {
  const w = 80
  const h = 22
  const min = data.reduce(
    (low, value) => (decimalUnits(value) < decimalUnits(low) ? value : low),
    '0',
  )
  const max = data.reduce(
    (high, value) => (decimalUnits(value) > decimalUnits(high) ? value : high),
    '0',
  )
  const span = subtractMoney(max, min)
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w
    const y = h - safePercent(subtractMoney(v, min), span) * h
    return `${x},${y}`
  })
  const line = `M${pts.join(' L')}`
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg width={w} height={h} className="shrink-0">
      {fill && <path d={area} fill={fill} opacity={0.25} />}
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.2} />
    </svg>
  )
}

// ─── Formatters / text builders ──────────────────────────────────────────

function formatPeakDay(
  d: Date,
  formatting: Pick<FormattingApi, 'formatCalendarDate'>,
): string {
  return formatting.formatCalendarDate(calendarDateFromLocalDate(d), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatChipDate(
  d: Date,
  formatting: Pick<FormattingApi, 'formatCalendarDate'>,
): string {
  return formatting.formatCalendarDate(d, { month: 'short', day: 'numeric' })
}

function buildEventCaption({
  days,
  lift,
  currency,
  top,
  isBalanceHidden,
  t,
  formatting,
}: {
  days: number
  lift: string | null
  currency: string
  top: readonly { readonly name: string }[]
  isBalanceHidden: boolean
  t: TFunction
  formatting: FormattingApi
}): string {
  const amt = (v: string) =>
    isBalanceHidden ? '••••' : formatting.formatAmount(v, currency)
  if (lift === null) return t('spendingMigration:baselineUnavailable')
  if (top.length === 0) {
    return decimalUnits(lift ?? '0') > 0n
      ? t('wfSpending:eventDetail.captionLift', {
          amount: `+${amt(lift)}`,
          days,
        })
      : t('wfSpending:eventDetail.captionInLine')
  }
  if (decimalUnits(lift ?? '0') > 0n && days <= 4) {
    if (top.length === 1) {
      return t('wfSpending:eventDetail.captionOneOffSingle', {
        name: top[0].name,
      })
    }
    return t('wfSpending:eventDetail.captionOneOffDouble', {
      name1: top[0].name,
      name2: top[1].name,
    })
  }
  if (decimalUnits(exactAbs(lift)) < 50000000n) {
    return t('wfSpending:eventDetail.captionMostly', {
      name: top[0].name,
    })
  }
  return t('wfSpending:eventDetail.captionLift', {
    amount: `${lift === null ? '' : decimalUnits(lift) >= 0n ? '+' : '−'}${amt(exactAbs(lift))}`,
    days,
  })
}

function formatRange(
  start: Date,
  end: Date,
  formatting: Pick<FormattingApi, 'formatCalendarDateRange'>,
): string {
  return formatting.formatCalendarDateRange(
    calendarDateFromLocalDate(start),
    calendarDateFromLocalDate(end),
    { month: 'short', day: 'numeric' },
  )
}

/** "2026-05-08" → "May 8" (parsed at noon to avoid UTC drift). */
function formatOutOfRangeDate(
  dateKey: string,
  formatting: Pick<FormattingApi, 'formatCalendarDate'>,
): string {
  return formatting.formatCalendarDate(
    new Date(`${dateKey.slice(0, 10)}T12:00:00`),
    { month: 'short', day: 'numeric' },
  )
}
