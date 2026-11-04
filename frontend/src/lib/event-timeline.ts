import type { EventReport } from './life-events'

const day = 86_400_000

/** Calendar coordinates only; amounts never participate in layout arithmetic. */
export function eventTimeline(events: EventReport[], month: string) {
  const start = Date.parse(`${month}-01T00:00:00Z`)
  const date = new Date(start)
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
  const lanes: number[] = []
  const bands = events
    .filter(
      ({ event }) =>
        Date.parse(event.start_date) < end &&
        Date.parse(event.end_date) + day > start,
    )
    .sort(
      (a, b) =>
        a.event.start_date.localeCompare(b.event.start_date) ||
        a.event.id.localeCompare(b.event.id),
    )
    .map((report) => {
      const from = Math.max(start, Date.parse(report.event.start_date))
      const to = Math.min(end, Date.parse(report.event.end_date) + day)
      let lane = lanes.findIndex((last) => last <= from)
      if (lane < 0) lane = lanes.length
      lanes[lane] = to
      return {
        report,
        lane,
        left: ((from - start) / (end - start)) * 100,
        width: ((to - from) / (end - start)) * 100,
      }
    })
  return {
    bands,
    lanes: lanes.length,
    offset: (date.getUTCDay() + 6) % 7,
    days: Array.from({ length: (end - start) / day }, (_, index) =>
      new Date(start + index * day).toISOString().slice(0, 10),
    ),
  }
}
