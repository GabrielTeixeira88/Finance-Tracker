import { eventTimeline } from './event-timeline'
import type { EventReport } from './life-events'

function event(id: string, start: string, end: string) {
  return { event: { id, start_date: start, end_date: end } } as EventReport
}
it('clips inclusive date bands and packs overlapping events into stable lanes', () => {
  const result = eventTimeline(
    [
      event('c', '2026-09-04', '2026-10-02'),
      event('b', '2026-09-02', '2026-09-05'),
      event('a', '2026-08-29', '2026-09-03'),
      event('outside', '2026-10-01', '2026-10-05'),
    ],
    '2026-09',
  )
  expect(result.bands.map((b) => [b.report.event.id, b.lane])).toEqual([
    ['a', 0],
    ['b', 1],
    ['c', 0],
  ])
  expect(result.bands[0].left).toBe(0)
  expect(result.bands[0].width).toBe(10)
  expect(result.bands[2].left + result.bands[2].width).toBe(100)
  expect(result.days).toHaveLength(30)
  expect(result.offset).toBe(1)
})
it('keeps leap days and handles an empty month', () => {
  expect(eventTimeline([], '2024-02').days.at(-1)).toBe('2024-02-29')
  expect(eventTimeline([], '2026-09').bands).toEqual([])
})
