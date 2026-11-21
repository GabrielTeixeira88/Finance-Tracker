// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 timeline render; local exact projection and dimensionless daily geometry.
import { cn } from '@/lib/utils'
import {
  calendarDateFromLocalDate,
  useDateFormatting,
  eventAggregate,
  type FormattingApi,
} from '../../../lib/event-adapter'
import { decimalUnits, subtractMoney, unitsToMoney } from '@/lib/money'
import { exactAbs } from '../../../compat'
import type { SpendingWorkspaceData } from '../../../api'
/**
 * Desktop SVG timeline of events overlaid on a daily-spend area chart, with a
 * 4-cell summary strip below. The mobile alternative is `events-calendar-card`.
 */
import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'

import { useBalancePrivacy } from '../../../lib/event-adapter'

import { getEventTypeLabel } from '../../../lib/event-adapter'
import { parseLocalDate } from '../../../lib/event-adapter'
import {
  Button,
  Icons,
  PrivacyAmount,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useAmountFormatting,
} from '../../../ui'

import { inclusiveDays } from '../../../lib/event-adapter'
import type { EventSpendingSummary } from '../../../lib/event-adapter'
import { useEventDialog } from '../../../lib/event-adapter'
import { getEventColors } from './event-colors'
const CARD_CLASS = 'p-5',
  LABEL_CLASS = 'text-muted-foreground/70 text-2xs uppercase tracking-[0.12em]'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'

export interface EventsTimelineCardProps {
  events: EventSpendingSummary[]
  currency: string
  rangeStart: Date
  rangeEnd: Date
  report: SpendingWorkspaceData
  selectedId: string | null
  onSelect: (id: string) => void
  /** 0 = current window, 1+ = N windows back. */
  windowOffset: number
  onPrevWindow: () => void
  onNextWindow: () => void
}

export const EventsTimelineCard: FC<EventsTimelineCardProps> = ({
  events,
  currency,
  rangeStart,
  rangeEnd,
  report,
  selectedId,
  onSelect,
  windowOffset,
  onPrevWindow,
  onNextWindow,
}) => {
  const amountFormatting = useAmountFormatting()
  const dateFormatting = useDateFormatting()
  const { t: tr } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()
  const { openEventDialog } = useEventDialog()
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const node = containerRef.current
    const update = () => setWidth(node.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const computed = useMemo(
    () => eventAggregate(events, report),
    [events, report],
  )
  const dailySeries = computed.series
  const periodDays = Math.max(1, inclusiveDays(rangeStart, rangeEnd))
  const W = Math.max(640, width || 1232)
  const padL = 14
  const padR = 64
  const innerW = W - padL - padR
  const dayW = innerW / periodDays

  const bandsTop = 48
  const bandsH = 56
  const LANE_STRIDE = bandsH + 6

  // Month markers
  const months = useMemo(
    () => buildMonthMarkers(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  )

  // Narrow-event label stacking — adjacent narrow bands stagger label rows.
  const WIDE_THRESHOLD = 50
  const NARROW_LABEL_W = 110

  // Wide-band lane assignment — overlapping wide bands stack vertically so
  // labels don't collide. Sorted by start x; each band claims the lowest lane
  // whose previous occupant ended before this one starts.
  const wideLaneByEventId = useMemo(() => {
    const result: Record<string, number> = {}
    const wide = events
      .map((e) => {
        const start = parseLocalDate(e.startDate)
        const end = parseLocalDate(e.endDate)
        const a = Math.max(
          0,
          Math.round((start.getTime() - rangeStart.getTime()) / 86_400_000),
        )
        const b = Math.min(
          periodDays - 1,
          Math.round((end.getTime() - rangeStart.getTime()) / 86_400_000),
        )
        const x1 = padL + a * dayW
        const w = Math.max((b - a + 1) * dayW, 6)
        return { id: e.eventId, x1, x2: x1 + w, wide: w > WIDE_THRESHOLD }
      })
      .filter((it) => it.wide)
      .sort((a, b) => a.x1 - b.x1)
    const laneRights: number[] = []
    for (const item of wide) {
      let lane = 0
      while (laneRights[lane] != null && laneRights[lane] > item.x1) lane++
      laneRights[lane] = item.x2
      result[item.id] = lane
    }
    return result
  }, [events, rangeStart, periodDays, dayW])

  const wideLaneCount = Math.max(
    1,
    ...Object.values(wideLaneByEventId).map((l) => l + 1),
  )
  const bandsAreaH = bandsH + (wideLaneCount - 1) * LANE_STRIDE
  const chartTop = bandsTop + bandsAreaH + 18
  const chartH = 96
  const axisTop = chartTop + chartH
  const totalH = axisTop + 30

  // Memoize SVG geometry — rebuilds only when daily series or chart dims change,
  // not on every parent render (selectedId change, etc).
  const { linePath, areaPath, yNormal, todayX, showToday } = useMemo(() => {
    const maxDaily = Math.max(1, ...dailySeries)
    const scaleMax = Math.max(maxDaily * 1.1, computed.normalPace * 2.2)
    const yDaily = (v: number) =>
      chartTop + chartH - (Math.min(v, scaleMax) / scaleMax) * chartH
    const points = dailySeries.map(
      (v, i) => [padL + (i + 0.5) * dayW, yDaily(v)] as const,
    )
    const linePath = points
      .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
      .join(' ')
    const areaPath = `${linePath} L${padL + innerW},${chartTop + chartH} L${padL},${chartTop + chartH} Z`
    const today = new Date(report.as_of + 'T12:00:00')
    const todayIdx = Math.round(
      (today.getTime() - rangeStart.getTime()) / 86_400_000,
    )
    return {
      linePath,
      areaPath,
      yNormal: yDaily(computed.normalPace),
      todayX: padL + (todayIdx + 0.5) * dayW,
      showToday: todayIdx >= 0 && todayIdx <= periodDays - 1,
    }
  }, [
    dailySeries,
    computed.normalPace,
    chartTop,
    chartH,
    padL,
    dayW,
    innerW,
    rangeStart,
    periodDays,
    report.as_of,
  ])

  const labelRowByEventId = useMemo(() => {
    const result: Record<string, number> = {}
    const rowEnds: number[] = []
    const indexed = events.map((e) => {
      const start = parseLocalDate(e.startDate)
      const end = parseLocalDate(e.endDate)
      const a = Math.max(
        0,
        Math.round((start.getTime() - rangeStart.getTime()) / 86_400_000),
      )
      const b = Math.min(
        periodDays - 1,
        Math.round((end.getTime() - rangeStart.getTime()) / 86_400_000),
      )
      return { e, a, b, x: padL + a * dayW }
    })
    indexed.sort((a, b) => a.x - b.x)
    for (const { e, a, b, x } of indexed) {
      const w = Math.max((b - a + 1) * dayW, 6)
      if (w > WIDE_THRESHOLD) continue
      const labelStart = x + w / 2 - NARROW_LABEL_W / 2
      const labelEnd = labelStart + NARROW_LABEL_W
      let row = 0
      while (rowEnds[row] != null && rowEnds[row] > labelStart) row++
      rowEnds[row] = labelEnd
      result[e.eventId] = row
    }
    return result
  }, [events, rangeStart, periodDays, dayW])

  const selected =
    events.find((e) => e.eventId === selectedId) ?? events[events.length - 1]
  const biggest = useMemo(
    () =>
      events
        .slice()
        .sort((a, b) =>
          decimalUnits(b.totalSpending ?? '0') >
          decimalUnits(a.totalSpending ?? '0')
            ? 1
            : -1,
        )[0],
    [events],
  )

  // Legend mirrors the actual event types present in the data — same color
  // source as the bands so the swatches always match what's drawn.
  const usedTypes = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; stroke: string; fill: string }
    >()
    for (const ev of events) {
      if (map.has(ev.eventTypeId)) continue
      const c = getEventColors(ev)
      map.set(ev.eventTypeId, {
        id: ev.eventTypeId,
        name: ev.eventTypeName
          ? getEventTypeLabel(tr, ev.eventTypeId, ev.eventTypeName)
          : tr('wfSpending:eventsCard.title'),
        stroke: c.stroke,
        fill: c.fill,
      })
    }
    return Array.from(map.values())
  }, [events, tr])

  return (
    <Card className={CARD_CLASS} ref={containerRef}>
      {/* HEADER */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-foreground text-base font-semibold tracking-tight">
            {tr('wfSpending:eventsCard.title')}
          </div>
          <div className="text-muted-foreground/80 text-2xs mt-0.5">
            {tr('wfSpending:timeline.headerSummary', {
              events: tr('wfSpending:timeline.taggedEvents', {
                count: events.length,
              }),
              days: computed.totalEventDays,
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {usedTypes.map((t) => (
            <span
              key={t.id}
              className="text-muted-foreground/80 text-2xs inline-flex items-center gap-1.5 tracking-wider"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{
                  background: t.fill,
                  border: `1.5px solid ${t.stroke}`,
                }}
              />
              {t.name.toUpperCase()}
            </span>
          ))}
          <div className="ms-1 inline-flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={tr('wfSpending:timeline.previousPeriod')}
                    className="h-7 w-7 rounded-full"
                    onClick={onPrevWindow}
                  />
                }
              >
                <Icons.ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              </TooltipTrigger>
              <TooltipContent>
                {tr('wfSpending:timeline.previousPeriod')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={tr('wfSpending:timeline.nextPeriod')}
                    className="h-7 w-7 rounded-full"
                    onClick={onNextWindow}
                    disabled={windowOffset === 0}
                  />
                }
              >
                <Icons.ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </TooltipTrigger>
              <TooltipContent>
                {windowOffset === 0
                  ? tr('wfSpending:timeline.alreadyCurrent')
                  : tr('wfSpending:timeline.nextPeriod')}
              </TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={tr('wfSpending:events.createEvent')}
                  className="h-7 w-7 rounded-full"
                  onClick={() =>
                    openEventDialog({
                      prefill: { startDate: rangeStart, endDate: rangeEnd },
                      onCreated: (ev) => onSelect(ev.id),
                    })
                  }
                />
              }
            >
              <Icons.Plus className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>
              {tr('wfSpending:events.createEvent')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* TIMELINE CHART */}
      <div className="relative w-full overflow-x-auto">
        <svg
          width={W}
          height={totalH}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* Month gridlines + labels */}
          {months.map((m, i) => {
            const x = padL + m.idx * dayW
            const showYear = m.date.getMonth() === 0 || i === 0
            const label = dateFormatting.formatCalendarDate(
              calendarDateFromLocalDate(m.date),
              {
                month: 'short',
                ...(showYear ? { year: 'numeric' } : {}),
              },
            )
            return (
              <g key={i}>
                <line
                  x1={x}
                  x2={x}
                  y1={20}
                  y2={chartTop + chartH}
                  stroke="currentColor"
                  className="text-foreground/10"
                  strokeDasharray="2 3"
                />
                <text
                  x={x + 6}
                  y={14}
                  className="fill-muted-foreground/80"
                  fontSize="0.6875rem"
                  letterSpacing={0.5}
                >
                  {label}
                </text>
              </g>
            )
          })}

          {/* Normal-pace baseline */}
          {computed.normalPace > 0 && (
            <>
              <line
                x1={padL}
                x2={padL + innerW}
                y1={yNormal}
                y2={yNormal}
                stroke="currentColor"
                className="text-muted-foreground/60"
                strokeDasharray="3 3"
              />
              <text
                x={padL + innerW + 4}
                y={yNormal + 3}
                fontSize="0.6875rem"
                className="fill-muted-foreground"
              >
                {isBalanceHidden
                  ? '••••'
                  : amountFormatting.formatCompactAmount(
                      computed.normalAmount,
                      currency,
                    )}
                {tr('wfSpending:eventDetail.perDayShort')}
              </text>
            </>
          )}

          {/* Daily area */}
          <path
            d={areaPath}
            fill="currentColor"
            className="text-foreground/5"
          />
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            className="text-muted-foreground/60"
          />

          {/* Highlight event regions on the daily chart */}
          {events.map((ev) => {
            const start = parseLocalDate(ev.startDate)
            const end = parseLocalDate(ev.endDate)
            const a = Math.max(
              0,
              Math.round((start.getTime() - rangeStart.getTime()) / 86_400_000),
            )
            const b = Math.min(
              periodDays - 1,
              Math.round((end.getTime() - rangeStart.getTime()) / 86_400_000),
            )
            if (b < 0 || a > periodDays - 1) return null
            const x1 = padL + a * dayW
            const x2 = padL + (b + 1) * dayW
            const c = getEventColors(ev)
            const isSel = selectedId === ev.eventId
            return (
              <rect
                key={'hl-' + ev.eventId}
                x={x1}
                y={chartTop - 2}
                width={x2 - x1}
                height={chartH + 4}
                fill={c.fill}
                opacity={isSel ? 0.55 : 0.28}
              />
            )
          })}

          {/* Re-stroke chart line on top of highlights */}
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            className="text-foreground/80"
          />

          {/* Event bands */}
          {events.map((ev) => {
            const start = parseLocalDate(ev.startDate)
            const end = parseLocalDate(ev.endDate)
            const a = Math.max(
              0,
              Math.round((start.getTime() - rangeStart.getTime()) / 86_400_000),
            )
            const b = Math.min(
              periodDays - 1,
              Math.round((end.getTime() - rangeStart.getTime()) / 86_400_000),
            )
            if (b < 0 || a > periodDays - 1) return null
            const x1 = padL + a * dayW
            const x2 = padL + (b + 1) * dayW
            const w = Math.max(x2 - x1, 6)
            const isSel = selectedId === ev.eventId
            const c = getEventColors(ev)
            const days = Math.max(1, b - a + 1)
            const expected =
              computed.normalAmount === null
                ? null
                : unitsToMoney(
                    decimalUnits(computed.normalAmount) * BigInt(days),
                  )
            const lift =
              ev.totalSpending === null || expected === null
                ? null
                : subtractMoney(ev.totalSpending, expected)
            const kindLabel = getEventTypeLabel(
              tr,
              ev.eventTypeId,
              ev.eventTypeName ?? '',
            )
            const labelRowIdx = labelRowByEventId[ev.eventId] ?? 0
            const labelYOffset = -4 - labelRowIdx * 12
            const isWide = w > WIDE_THRESHOLD
            const bandY = isWide
              ? bandsTop + (wideLaneByEventId[ev.eventId] ?? 0) * LANE_STRIDE
              : bandsTop

            return (
              <g
                key={ev.eventId}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={ev.eventName}
                aria-description={
                  lift === null
                    ? tr('spendingMigration:baselineUnavailable')
                    : undefined
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(ev.eventId)
                  }
                }}
                onClick={() => onSelect(ev.eventId)}
              >
                {lift === null && (
                  <title>{tr('spendingMigration:baselineUnavailable')}</title>
                )}
                <rect
                  x={x1}
                  y={bandY}
                  width={w}
                  height={bandsH - 4}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={isSel ? 2 : 1}
                  rx={4}
                  opacity={isSel ? 1 : 0.85}
                />
                <rect
                  x={x1}
                  y={bandY}
                  width={3}
                  height={bandsH - 4}
                  fill={c.stroke}
                  opacity={isSel ? 1 : 0.7}
                />

                {isWide ? (
                  <>
                    <text
                      x={x1 + 8}
                      y={bandY + 16}
                      fontSize="0.6875rem"
                      className="fill-foreground"
                      fontWeight={isSel ? 700 : 600}
                    >
                      {ev.eventName}
                    </text>
                    <text
                      x={x1 + 8}
                      y={bandY + 32}
                      fontSize="0.6875rem"
                      fontWeight={600}
                      className={
                        lift === null
                          ? 'fill-muted-foreground'
                          : decimalUnits(lift) >= 0n
                            ? 'fill-destructive'
                            : 'fill-success'
                      }
                    >
                      {lift === null
                        ? ''
                        : decimalUnits(lift) >= 0n
                          ? '+'
                          : '−'}
                      {isBalanceHidden
                        ? '••••'
                        : amountFormatting.formatCompactAmount(
                            lift === null ? null : exactAbs(lift),
                            currency,
                          )}
                    </text>
                    <text
                      x={x1 + 8}
                      y={bandY + 46}
                      fontSize="0.6875rem"
                      className="fill-muted-foreground"
                    >
                      {tr('wfSpending:timeline.daysUpper', { count: days })} ·{' '}
                      {kindLabel}
                    </text>
                  </>
                ) : (
                  <g>
                    {labelRowIdx > 0 && (
                      <line
                        x1={x1 + w / 2}
                        x2={x1 + w / 2}
                        y1={bandY}
                        y2={bandY + labelYOffset + 2}
                        stroke={c.stroke}
                        strokeWidth={1}
                        opacity={0.5}
                      />
                    )}
                    <text
                      x={x1 + w / 2}
                      y={bandY + labelYOffset}
                      fontSize="0.6875rem"
                      fontWeight={isSel ? 700 : 500}
                      textAnchor="middle"
                      className={
                        isSel ? 'fill-foreground' : 'fill-foreground/80'
                      }
                    >
                      {ev.eventName}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* Today marker */}
          {showToday && (
            <>
              <line
                x1={todayX}
                x2={todayX}
                y1={4}
                y2={chartTop + chartH}
                stroke="var(--event-today)"
                strokeWidth={1.5}
              />
              <circle cx={todayX} cy={4} r={3} fill="var(--event-today)" />
              <text
                x={todayX + 6}
                y={14}
                fontSize="0.6875rem"
                fontWeight={600}
                fill="var(--event-today)"
              >
                {tr('wfSpending:timeline.today')}
              </text>
            </>
          )}

          {/* Bookend dates */}
          <text
            x={padL}
            y={axisTop + 14}
            fontSize="0.6875rem"
            className="fill-muted-foreground"
          >
            {formatBookendDate(rangeStart, dateFormatting)}
          </text>
          <text
            x={padL + innerW}
            y={axisTop + 14}
            fontSize="0.6875rem"
            textAnchor="end"
            className="fill-muted-foreground"
          >
            {formatBookendDate(rangeEnd, dateFormatting)} ·{' '}
            {tr('wfSpending:timeline.daysUpper', { count: periodDays })}
          </text>
          <text
            x={padL + innerW / 2}
            y={axisTop + 14}
            fontSize="0.6875rem"
            textAnchor="middle"
            className="fill-muted-foreground/70"
          >
            {tr('wfSpending:timeline.dailySpend')}
          </text>
        </svg>
      </div>

      {/* Summary strip */}
      <div className="border-border/40 mt-3 grid grid-cols-2 gap-x-0 gap-y-3 border-t pt-3 md:grid-cols-4">
        <SummaryCell
          label={tr('wfSpending:timeline.acrossEvents', {
            count: events.length,
          })}
        >
          <div className="text-foreground text-sm font-semibold tracking-tight tabular-nums">
            <PrivacyAmount value={computed.totalSpent} currency={currency} />
          </div>
          <div className="text-muted-foreground/80 text-2xs mt-0.5">
            {tr('wfSpending:timeline.eventDaysOfPeriod', {
              days: computed.totalEventDays,
              pct: Math.round((computed.totalEventDays / periodDays) * 100),
            })}
          </div>
        </SummaryCell>
        <SummaryCell label={tr('wfSpending:timeline.combinedLift')} divided>
          <div
            className={cn(
              'text-sm font-semibold tabular-nums tracking-tight',
              decimalUnits(computed.lift ?? '0') >= 0n
                ? 'text-destructive'
                : 'text-success',
            )}
          >
            {computed.lift === null
              ? ''
              : decimalUnits(computed.lift) >= 0n
                ? '+'
                : '−'}
            <PrivacyAmount
              value={computed.lift === null ? null : exactAbs(computed.lift)}
              currency={currency}
            />
          </div>
          <div className="text-muted-foreground/80 text-2xs mt-0.5">
            {tr('wfSpending:timeline.onEventDays')}
          </div>
        </SummaryCell>
        {biggest && (
          <SummaryCell label={tr('wfSpending:timeline.biggestEvent')} divided>
            <div className="text-foreground truncate text-sm font-semibold tracking-tight">
              {biggest.eventName}
            </div>
            <div className="text-muted-foreground/80 text-2xs mt-0.5 tabular-nums">
              <PrivacyAmount
                value={biggest.totalSpending}
                currency={currency}
              />
            </div>
          </SummaryCell>
        )}
        {selected && (
          <SummaryCell label={tr('wfSpending:timeline.selected')} divided>
            <div className="mt-0.5 inline-flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  background: getEventColors(selected).fill,
                  border: `1.5px solid ${getEventColors(selected).stroke}`,
                }}
              />
              <span className="text-foreground truncate text-sm font-semibold tracking-tight">
                {selected.eventName}
              </span>
            </div>
            <div className="text-muted-foreground/80 text-2xs mt-0.5 tabular-nums">
              {formatSelectedRange(
                parseLocalDate(selected.startDate),
                parseLocalDate(selected.endDate),
                dateFormatting,
              )}{' '}
              ·{' '}
              {tr('wfSpending:timeline.daysUpper', {
                count: inclusiveDays(
                  parseLocalDate(selected.startDate),
                  parseLocalDate(selected.endDate),
                ),
              })}
            </div>
          </SummaryCell>
        )}
      </div>
    </Card>
  )
}

function SummaryCell({
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
      <div className="mt-1">{children}</div>
    </div>
  )
}

interface MonthMarker {
  idx: number
  date: Date
}

function buildMonthMarkers(rangeStart: Date, rangeEnd: Date): MonthMarker[] {
  const out: MonthMarker[] = []
  const cursor = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    1,
    12,
    0,
    0,
    0,
  )
  while (cursor <= rangeEnd) {
    const idx = Math.round(
      (cursor.getTime() - rangeStart.getTime()) / 86_400_000,
    )
    out.push({ idx, date: new Date(cursor) })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return out
}

function formatBookendDate(
  d: Date,
  formatting: Pick<FormattingApi, 'formatCalendarDate'>,
): string {
  return formatting.formatCalendarDate(calendarDateFromLocalDate(d), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatSelectedRange(
  start: Date,
  end: Date,
  formatting: Pick<FormattingApi, 'formatCalendarDateRange'>,
): string {
  return formatting.formatCalendarDateRange(
    calendarDateFromLocalDate(start),
    calendarDateFromLocalDate(end),
    { month: '2-digit', day: '2-digit' },
  )
}
