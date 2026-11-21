// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 holdings/components/allocation-detail-sheet.tsx.
// Uses Finance Tracker's existing dated allocation API; cash is retained in the
// investment bucket because our authoritative Net Worth bucket includes it once.
import { useQuery } from '@tanstack/react-query'
import { analyticsParams, getAllocation } from '@/lib/investment-analytics'
import { decimalUnits } from '@/lib/money'
import { t, ui } from '@/lib/i18n'
import { Money, LoadingState, ErrorState } from './primitives'
export function NetWorthInvestments({
  asOf,
  currency,
  expected,
}: {
  asOf: string
  currency: string
  expected: string | null
}) {
  const params = analyticsParams('', asOf, currency, '')
  const query = useQuery({
    queryKey: ['investment-allocation', params],
    queryFn: ({ signal }) => getAllocation(params, signal),
  })
  if (query.isPending) return <LoadingState />
  if (query.isError)
    return (
      <ErrorState
        text={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  const data = query.data
  if (
    data.quality !== 'COMPLETE' ||
    data.total_value === null ||
    expected === null ||
    decimalUnits(data.total_value) !== decimalUnits(expected)
  )
    return <p className="metadata">{t('networth:incomplete')}</p>
  return (
    <section aria-label={t('networth:investment_composition')}>
      <h3 className="net-worth-small-label">
        {t('networth:investment_composition')}
      </h3>
      {(data.groups.asset_class ?? []).map((row, index) => (
        <div className="net-worth-class-row" key={row.name}>
          <i style={{ background: `var(--chart-${(index % 8) + 1})` }} />
          <span>
            {row.name === 'BOND' ? t('fixed_income:title') : ui(row.name)}
          </span>
          {row.value === null ? (
            t('common:unavailable')
          ) : (
            <Money value={row.value} currency={currency} minorUnits />
          )}
        </div>
      ))}
    </section>
  )
}
