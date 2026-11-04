import { t as tr, ui } from '@/lib/i18n'
import { useQuery } from '@tanstack/react-query'
import { analyticsParams, getAllocation } from '@/lib/investment-analytics'
import { CompositionChart } from './composition-chart'
import { LoadingState, ErrorState } from './primitives'

export function PortfolioComposition({
  accountId,
  asOf,
  currency,
  onSecurity,
}: {
  accountId: string
  asOf: string
  currency: string
  onSecurity: (id: string) => void
}) {
  const params = analyticsParams('', asOf, currency, accountId)
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
  const items = (key: string) =>
    (data.groups[key] ?? []).map((g) => ({
      name:
        key === 'asset_class'
          ? g.name === 'BOND'
            ? tr('fixed_income:title')
            : ui(g.name)
          : g.name,
      value: g.value,
      weight: g.weight_percent,
      id: g.members.find((m) => m.asset_id)?.asset_id ?? undefined,
    }))
  return (
    <>
      <div className="visual-grid">
        <CompositionChart
          title={tr('portfolio_composition:asset_allocation_aced44')}
          items={items('asset_class')}
          currency={data.currency}
          complete={data.quality === 'COMPLETE'}
        />
        <CompositionChart
          title={tr('portfolio_composition:currency_exposure_7dbdb9')}
          items={items('currency')}
          currency={data.currency}
          complete={data.quality === 'COMPLETE'}
        />
      </div>
      <CompositionChart
        title={tr(
          'portfolio_composition:holdings_composition_including_cash_380806',
        )}
        items={items('security')}
        currency={data.currency}
        complete={data.quality === 'COMPLETE'}
        kind="treemap"
        onSelect={(item) => {
          if (item.id) onSecurity(item.id)
        }}
      />
      <p className="metadata">
        {data.currency} ·{' '}
        {tr(
          'portfolio_composition:brl_reporting_cached_valuation_not_performance_m_7fda9f',
        )}
      </p>
    </>
  )
}
