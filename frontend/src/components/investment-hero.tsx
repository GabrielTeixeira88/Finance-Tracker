import { useQuery } from '@tanstack/react-query'
import {
  analyticsParams,
  getPerformance,
  startDate,
  percent,
} from '@/lib/investment-analytics'
import { useRoute, navigateTo } from '@/lib/navigation'
import { t } from '@/lib/i18n'
import { ErrorState, LoadingState, Money } from './primitives'
import { PortfolioValueChart } from './portfolio-value-chart'
import { MotionChoice } from './selection-indicator'
import { useSelectionId } from '@/lib/motion'

const ranges = ['1M', '3M', '6M', '1Y', 'ALL']

/** One historical response owns the headline, gains, TWR and plotted values. */
export function InvestmentHero({
  accountId,
  asOf,
}: {
  accountId: string
  asOf: string
}) {
  const route = useRoute()
  const rangeId = useSelectionId()
  const range = ranges.includes(route.params.get('range') ?? '')
    ? route.params.get('range')!
    : '3M'
  const currency = route.params.get('currency') || 'BRL'
  const params = analyticsParams(
    range === 'ALL' ? '' : startDate(range, asOf, ''),
    asOf,
    currency,
    accountId,
  )
  const query = useQuery({
    queryKey: ['investments', 'analytics', 'performance', params],
    queryFn: ({ signal }) => getPerformance(params, signal),
  })
  const change = (values: Record<string, string>) =>
    navigateTo('Investments', undefined, {
      ...Object.fromEntries(route.params),
      view: 'Overview',
      ...values,
    })
  const data = query.data
  return (
    <section className="investment-hero">
      <div className="investment-hero-heading">
        <div>
          <span className="metadata">
            {t('market_data:portfolio_value_73adb8')}
          </span>
          <strong className="investment-hero-value">
            {data ? (
              data.ending_value === null ? (
                t('common:unavailable')
              ) : (
                <Money
                  minorUnits
                  value={data.ending_value}
                  currency={data.currency}
                />
              )
            ) : (
              '\u2014'
            )}
          </strong>
          {data && (
            <div className="investment-hero-results">
              <span>
                {t('parity:period_gain')}:{' '}
                {data.absolute_gain.value === null ? (
                  t('common:unavailable')
                ) : (
                  <Money
                    minorUnits
                    value={data.absolute_gain.value}
                    currency={data.currency}
                  />
                )}
              </span>
              <span>
                {t('parity:period_twr')}: {percent(data.twr.value)}
              </span>
              <small>
                {data.start} – {data.end}
              </small>
            </div>
          )}
        </div>
        <select
          aria-label={t('market_data:valuation_currency_83a461')}
          value={currency}
          onChange={(e) => change({ currency: e.target.value })}
        >
          {[...new Set([currency, 'BRL', 'USD', 'EUR', 'JPY'])].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : data?.valuation ? (
        <PortfolioValueChart history={data.valuation} hero />
      ) : (
        <p role="status">{t('parity:history_unavailable')}</p>
      )}
      <nav
        className="range-tabs investment-hero-ranges"
        aria-label={t('market_data:portfolio_history_range_c2d368')}
      >
        {ranges.map((r) => (
          <MotionChoice
            key={r}
            groupId={rangeId}
            selected={range === r}
            onClick={() => change({ range: r })}
          >
            {r}
          </MotionChoice>
        ))}
      </nav>
      {data &&
        (data.absolute_gain.quality !== 'COMPLETE' ||
          data.twr.quality !== 'COMPLETE') && (
          <p role="status" className="metadata">
            {t('parity:partial_performance')}
          </p>
        )}
      {data && (
        <details className="chart-data">
          <summary>{t('parity:details')}</summary>
          <p>{t('parity:value_not_return')}</p>
          <p>
            {[
              ...new Set([...data.absolute_gain.reasons, ...data.twr.reasons]),
            ].join(', ')}
          </p>
        </details>
      )}
    </section>
  )
}
