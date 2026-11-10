import { sumMoney } from '@/lib/money'
import { useMemo } from 'react'
import type { EventReport } from '@/lib/life-events'
import type { SpendingWorkspaceData } from '../api'
import {
  eventDialogContext,
  sourceEvents,
  useIsMobileViewport,
  parseLocalDate,
} from '../lib/event-adapter'
import { EventsTimelineCard } from './reports/insights/events-timeline-card'
import { EventsCalendarCard } from './reports/insights/events-calendar-card'
import { WhenYouSpendCard } from './reports/insights/when-you-spend-card'
import { dayAfter } from '@/lib/spending-period'
/** One source-style event visualization; editing/linking remains with established event services. */
export function EventVisuals({
  reports,
  report,
  selected,
  onSelect,
  onCreate,
  onRange,
}: {
  reports: EventReport[]
  report: SpendingWorkspaceData
  selected: string | null
  onSelect: (id: string) => void
  onCreate: (options?: {
    prefill?: { startDate?: Date; endDate?: Date }
    onCreated?: (event: { id: string }) => void
  }) => void
  onRange: (start: string, end: string) => void
}) {
  const mobile = useIsMobileViewport()
  const events = useMemo(
    () =>
      sourceEvents(reports)
        .map((event) => ({
          ...event,
          totalSpending: reports.find((row) => row.event.id === event.eventId)
            ?.complete
            ? sumMoney(
                reports
                  .find((row) => row.event.id === event.eventId)!
                  .daily.filter(
                    (row) =>
                      row.date >= report.start &&
                      row.date < report.end_exclusive,
                  )
                  .map((row) => row.value),
              )
            : null,
        }))
        .filter(
          (event) =>
            event.currency === report.currency &&
            event.startDate < report.end_exclusive &&
            event.endDate >= report.start,
        ),
    [reports, report],
  )
  const from = parseLocalDate(report.start),
    to = parseLocalDate(dayAfter(report.end_exclusive, -1))
  const days = report.daily.length
  return (
    <eventDialogContext.Provider value={{ openEventDialog: onCreate }}>
      <div className="flex flex-col gap-6">
        <WhenYouSpendCard report={report} />
        {mobile ? (
          <EventsCalendarCard
            events={sourceEvents(reports).filter(
              (event) => event.currency === report.currency,
            )}
            currency={report.currency}
            selectedId={selected}
            onSelect={onSelect}
            rangeStart={from}
            rangeEnd={to}
            asOf={report.as_of}
          />
        ) : (
          <EventsTimelineCard
            events={events}
            currency={report.currency}
            selectedId={selected}
            onSelect={onSelect}
            rangeStart={from}
            rangeEnd={to}
            report={report}
            windowOffset={report.end_exclusive < dayAfter(report.as_of) ? 1 : 0}
            onPrevWindow={() =>
              onRange(dayAfter(report.start, -days), dayAfter(report.start, -1))
            }
            onNextWindow={() =>
              onRange(
                dayAfter(report.start, days),
                dayAfter(report.end_exclusive, days - 1) > report.as_of
                  ? report.as_of
                  : dayAfter(report.end_exclusive, days - 1),
              )
            }
          />
        )}
      </div>
    </eventDialogContext.Provider>
  )
}
