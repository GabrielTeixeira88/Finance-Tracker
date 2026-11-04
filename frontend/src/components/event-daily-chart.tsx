import { chartCoordinates, formatDate, formatMoney } from '@/lib/money'
import { t } from '@/lib/i18n'
import { Money } from './primitives'

/** Exact ledger labels; only normalized, dimensionless coordinates enter SVG. */
export function EventDailyChart({
  points,
  currency,
}: {
  points: { date: string; value: string }[]
  currency: string
}) {
  const coordinates = chartCoordinates(
    points.map((p) => ({ date: p.date, balance: p.value })),
  )
  const from = Date.parse(points[0]?.date ?? '1970-01-01')
  const span = Math.max(
    86400000,
    Date.parse(points.at(-1)?.date ?? '1970-01-01') - from,
  )
  const dots = coordinates.map((p) => ({
    ...p,
    x: 10 + ((Date.parse(p.date) - from) / span) * 980,
    y: 110 - p.coordinate,
  }))
  return (
    <figure
      className="event-daily-chart"
      aria-label={t('parity:daily_spending')}
    >
      <svg
        viewBox="0 0 1000 120"
        preserveAspectRatio="none"
        role="img"
        aria-label={t('parity:daily_spending')}
      >
        <polyline
          points={dots.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {dots.map((p) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r="3"
            tabIndex={0}
            aria-label={`${formatDate(p.date)}: ${formatMoney(p.balance, currency)}`}
          >
            <title>
              {formatDate(p.date)}: {formatMoney(p.balance, currency)}
            </title>
          </circle>
        ))}
      </svg>
      <figcaption>
        {t('parity:daily_spending')} · {currency}
      </figcaption>
      <details>
        <summary>{t('parity:details')}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('parity:date')}</th>
                <th>{t('parity:actual_cost')}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{formatDate(p.date)}</td>
                  <td className="amount-cell">
                    <Money value={p.value} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
