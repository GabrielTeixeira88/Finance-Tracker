import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  Plane,
  Home,
  Heart,
  Car,
  Music,
  BookOpen,
  X,
} from 'lucide-react'
import { DetailDrawer } from '@/components/detail-drawer'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { CompositionChart } from '@/components/composition-chart'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  SectionHeader,
} from '@/components/primitives'
import { getEvents, type LifeEvent, type EventReport } from '@/lib/life-events'
import { getDemoDate, getTransactions, localDate } from '@/lib/api'
import { useWrite } from '@/lib/use-write'
import { exactFormData } from '@/lib/localized-number'
import { formatDate } from '@/lib/money'
import { t } from '@/lib/i18n'
import { useRoute, navigateTo } from '@/lib/navigation'
import type { BudgetReport } from '@/lib/budget-api'
import { eventTimeline } from '@/lib/event-timeline'
import { EventDailyChart } from '@/components/event-daily-chart'
import './life-events.css'

const icons = {
  calendar: CalendarDays,
  plane: Plane,
  home: Home,
  heart: Heart,
  car: Car,
  music: Music,
  book: BookOpen,
}
export default function LifeEvents({ context }: { context?: BudgetReport }) {
  const query = useQuery({ queryKey: ['life-events'], queryFn: getEvents })
  const route = useRoute()
  const selected = route.params.get('event') ?? ''
  const setSelected = (id: string) =>
    navigateTo('Budget', undefined, {
      ...Object.fromEntries(route.params),
      view: 'Life Events',
      event: id,
    })
  const [create, setCreate] = useState(false)
  const [currency, setCurrency] = useState(context?.currency ?? '')
  if (query.isPending) return <LoadingState />
  if (query.isError)
    return (
      <ErrorState
        text={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  const events = query.data.filter(
    (r) => !currency || r.event.currency === currency,
  )
  const current = query.data.find((r) => r.event.id === selected)
  const month = route.params
    .get('month')
    ?.match(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/)
    ? route.params.get('month')!
    : (getDemoDate() ?? localDate()).slice(0, 7)
  const timeline = eventTimeline(events, month)
  return (
    <section className="life-events">
      <SectionHeader title={t('parity:life_events')}>
        <Button onClick={() => setCreate(true)}>{t('parity:add_event')}</Button>
      </SectionHeader>
      {!context && (
        <>
          {' '}
          <Field label={t('parity:currency')}>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="">{t('parity:all_currencies')}</option>
              {[...new Set(query.data.map((r) => r.event.currency))].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </Field>
        </>
      )}
      <section
        className="event-timeline"
        aria-label={t('parity:event_timeline')}
      >
        <div className="event-time-scale">
          <span>{formatDate(timeline.days[0])}</span>
          <span>{formatDate(timeline.days.at(-1)!)}</span>
        </div>
        {!timeline.bands.length && <EmptyState title={t('parity:no_events')} />}
        <div
          className="event-desktop-lanes"
          style={{ height: Math.max(1, timeline.lanes) * 78 }}
        >
          {timeline.bands.map(({ report: r, lane, left, width }) => {
            const e = r.event
            const Icon = icons[e.icon as keyof typeof icons] ?? CalendarDays
            return (
              <button
                key={e.id}
                className={`event-band event-color-${e.color}`}
                aria-pressed={selected === e.id}
                onClick={() => setSelected(e.id)}
                title={`${e.name}: ${formatDate(e.start_date)} - ${formatDate(e.end_date)}`}
                style={{ left: `${left}%`, width: `${width}%`, top: lane * 78 }}
              >
                <span>
                  <Icon size={14} />
                  <span>{e.name}</span>
                </span>
                <strong>
                  {r.actual_cost === null ? (
                    t('common:unavailable')
                  ) : (
                    <Money value={r.actual_cost} currency={e.currency} />
                  )}
                </strong>
                <small>{t(`parity:${e.event_type.toLowerCase()}`)}</small>
              </button>
            )
          })}
        </div>
        {context && currency === context.currency && (
          <div className="event-context-chart">
            <EventDailyChart
              points={context.daily
                .filter((d) => d.date <= context.as_of)
                .map((d) => ({ date: d.date, value: d.amount }))}
              currency={context.currency}
            />
          </div>
        )}
        <div className="event-calendar" aria-label={t('parity:event_calendar')}>
          {Array.from({ length: timeline.offset }, (_, i) => (
            <span key={`empty-${i}`} />
          ))}
          {timeline.days.map((date) => {
            const matches = timeline.bands.filter(
              ({ report: r }) =>
                r.event.start_date <= date && r.event.end_date >= date,
            )
            return (
              <div key={date} className="event-calendar-day">
                <time dateTime={date}>{date.slice(-2)}</time>
                {matches.map(({ report: r }) => (
                  <button
                    key={r.event.id}
                    className={`event-color-${r.event.color}`}
                    aria-label={`${formatDate(date)}: ${r.event.name}`}
                    aria-pressed={selected === r.event.id}
                    onClick={() => setSelected(r.event.id)}
                  >
                    {r.event.name}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </section>
      {create && (
        <DetailDrawer
          title={t('parity:add_event')}
          onClose={() => setCreate(false)}
        >
          <EventEditor onDone={() => setCreate(false)} />
        </DetailDrawer>
      )}
      {current && (
        <section
          className="event-inline-detail"
          aria-label={current.event.name}
        >
          <SectionHeader title={current.event.name}>
            <Button
              variant="ghost"
              aria-label={t('parity:close')}
              onClick={() => setSelected('')}
            >
              <X size={16} />
            </Button>
          </SectionHeader>
          <EventDetail
            key={current.event.id}
            report={current}
            events={query.data}
            onClose={() => setSelected('')}
          />
        </section>
      )}
    </section>
  )
}

function EventEditor({
  event,
  onDone,
}: {
  event?: LifeEvent
  onDone: () => void
}) {
  const write = useWrite()
  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault()
        const d = Object.fromEntries(exactFormData(e.currentTarget))
        write.mutate(
          {
            path: `/life-events${event ? '/' + event.id : ''}`,
            method: event ? 'PATCH' : 'POST',
            data: { ...d, planned_budget: d.planned_budget || null },
          },
          { onSuccess: onDone },
        )
      }}
    >
      <div className="form-grid">
        <Field label={t('parity:event_name')}>
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={event?.name}
          />
        </Field>
        <Field label={t('parity:description')}>
          <input
            name="description"
            maxLength={1000}
            defaultValue={event?.description}
          />
        </Field>
        <Field label={t('parity:event_type')}>
          <select
            name="event_type"
            defaultValue={event?.event_type ?? 'TRAVEL'}
          >
            {[
              'TRAVEL',
              'HOME',
              'WEDDING',
              'VEHICLE',
              'FESTIVAL',
              'MEDICAL',
              'EDUCATION',
              'OTHER',
            ].map((v) => (
              <option key={v} value={v}>
                {t(`parity:${v.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('parity:currency')}>
          <input
            name="currency"
            required
            pattern="[A-Z]{3}"
            defaultValue={event?.currency ?? 'BRL'}
          />
        </Field>
        <Field label={t('parity:start')}>
          <input
            type="date"
            name="start_date"
            required
            defaultValue={event?.start_date ?? getDemoDate() ?? localDate()}
          />
        </Field>
        <Field label={t('parity:end')}>
          <input
            type="date"
            name="end_date"
            required
            defaultValue={event?.end_date ?? getDemoDate() ?? localDate()}
          />
        </Field>
        <Field label={t('parity:planned_budget')}>
          <input
            name="planned_budget"
            inputMode="decimal"
            defaultValue={event?.planned_budget ?? ''}
          />
        </Field>
        <Field label={t('parity:color')}>
          <select name="color" defaultValue={event?.color ?? 'primary'}>
            {['primary', 'blue', 'amber', 'purple', 'green'].map((v) => (
              <option key={v} value={v}>
                {t(`parity:${v}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('parity:icon')}>
          <select name="icon" defaultValue={event?.icon ?? 'calendar'}>
            {Object.keys(icons).map((v) => (
              <option key={v} value={v}>
                {t(`parity:${v}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {write.isError && <ErrorState text={write.error.message} />}
      <Button disabled={write.isPending}>{t('parity:save')}</Button>
    </form>
  )
}

function EventDetail({
  report: r,
  events,
  onClose,
}: {
  report: EventReport
  events: EventReport[]
  onClose: () => void
}) {
  const [edit, setEdit] = useState(false)
  const [linking, setLinking] = useState(false)
  const write = useWrite()
  const e = r.event
  return (
    <>
      <p className="metadata">
        {formatDate(e.start_date)} – {formatDate(e.end_date)} ·{' '}
        {t(`parity:${e.event_type.toLowerCase()}`)}
      </p>
      <p>{e.description}</p>
      <div className="form-actions">
        <Button variant="outline" onClick={() => setEdit(!edit)}>
          {t('parity:edit')}
        </Button>
        <Button onClick={() => setLinking(!linking)}>
          {t('parity:link_transactions')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm(t('parity:delete_event_confirm')))
              write.mutate(
                { path: `/life-events/${e.id}`, method: 'DELETE' },
                { onSuccess: onClose },
              )
          }}
        >
          {t('parity:delete_event')}
        </Button>
      </div>
      {edit && (
        <DetailDrawer title={t('parity:edit')} onClose={() => setEdit(false)}>
          <EventEditor event={e} onDone={() => setEdit(false)} />
        </DetailDrawer>
      )}
      {linking && <EventLinker report={r} events={events} />}
      {write.isError && <ErrorState text={write.error.message} />}
      <div className="event-summary">
        {[
          ['actual_cost', r.actual_cost],
          ['planned_budget', e.planned_budget],
          ['remaining', r.remaining],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{t(`parity:${k}`)}</small>
            <strong>
              {v === null ? '—' : <Money value={v!} currency={e.currency} />}
            </strong>
          </div>
        ))}
        <div>
          <small>{t('parity:transactions')}</small>
          <strong>{r.transaction_count}</strong>
        </div>
      </div>
      {!r.complete && <p role="status">{t('parity:missing_fx')}</p>}
      <div className="visual-grid">
        <EventDailyChart points={r.daily} currency={e.currency} />
        <CompositionChart
          title={t('parity:categories')}
          currency={e.currency}
          complete={r.complete}
          items={r.categories.map((row) => ({
            ...row,
            id: row.id ?? 'uncategorized',
          }))}
        />
      </div>
      <p className="metadata">{t('parity:event_refunds')}</p>
      <div className="table-scroll">
        <table className="investment-table">
          <caption>{t('parity:event_transactions')}</caption>
          <thead>
            <tr>
              {[
                'date',
                'description',
                'original',
                'actual_cost',
                'association',
              ].map((k) => (
                <th key={k}>{t(`parity:${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.transactions.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.date)}</td>
                <td>{row.description}</td>
                <td>
                  <Money value={row.amount} currency={row.currency} />
                </td>
                <td>
                  {row.value === null ? (
                    t('common:unavailable')
                  ) : (
                    <Money value={row.value} currency={e.currency} />
                  )}
                </td>
                <td>
                  {row.refund ? (
                    t('parity:linked_refund')
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={write.isPending}
                      onClick={() =>
                        write.mutate({
                          path: `/life-events/${e.id}/transactions/${row.id}`,
                          method: 'DELETE',
                        })
                      }
                    >
                      {t('parity:unlink')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function EventLinker({
  report: r,
  events,
}: {
  report: EventReport
  events: EventReport[]
}) {
  const associations = new Map(
    events.flatMap((event) =>
      event.linked_ids.map((id) => [id, event.event.name] as const),
    ),
  )
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const write = useWrite()
  const query = useQuery({
    queryKey: ['event-candidates', r.event.id, page, search],
    queryFn: ({ signal }) =>
      getTransactions(
        new URLSearchParams({
          transaction_type: 'EXPENSE',
          date_from: r.event.start_date,
          date_to: r.event.end_date,
          limit: '25',
          offset: String(page * 25),
          search,
        }),
        signal,
      ),
  })
  return (
    <section className="event-linker">
      <Field label={t('parity:search_transactions')}>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
            setSelected([])
          }}
        />
      </Field>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState text={query.error.message} />
      ) : (
        <>
          {query.data.map((row) => (
            <label className="event-candidate" key={row.id}>
              <input
                type="checkbox"
                disabled={associations.has(row.id)}
                checked={selected.includes(row.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, row.id]
                      : selected.filter((id) => id !== row.id),
                  )
                }
              />
              <span>
                {formatDate(row.transaction_date)} · {row.description}
                {associations.has(row.id) && (
                  <small className="metadata">
                    {' '}
                    · {t('parity:associated_event')}: {associations.get(row.id)}
                  </small>
                )}
              </span>
              <Money value={row.amount} currency={row.currency} />
            </label>
          ))}
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={!page}
              onClick={() => {
                setPage(page - 1)
                setSelected([])
              }}
            >
              {t('parity:previous')}
            </Button>
            <Button
              variant="outline"
              disabled={query.data.length < 25}
              onClick={() => {
                setPage(page + 1)
                setSelected([])
              }}
            >
              {t('parity:next')}
            </Button>
            <Button
              disabled={!selected.length || write.isPending}
              onClick={() =>
                write.mutate(
                  {
                    path: `/life-events/${r.event.id}/transactions`,
                    data: { transaction_ids: selected },
                  },
                  { onSuccess: () => setSelected([]) },
                )
              }
            >
              {t('parity:link_selected', { count: selected.length })}
            </Button>
          </div>
        </>
      )}
      {write.isError && <ErrorState text={write.error.message} />}
    </section>
  )
}
