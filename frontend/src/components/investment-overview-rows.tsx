import { getGoals } from '@/lib/wealth-api'
import { navigateTo } from '@/lib/navigation'
import { localDate } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import {
  Money,
  SectionHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from './primitives'
import { getAllocation } from '@/lib/investment-analytics'
import { overviewGroups, topHoldings } from '@/lib/portfolio-overview'
import { t } from '@/lib/i18n'

export function InvestmentOverviewRows({
  assets,
  accountId,
  asOf,
  currency,
  onAccount,
  onSecurity,
  onHoldings,
}: {
  assets: { id: string; name: string; symbol: string }[]
  accountId: string
  asOf: string
  currency: string
  onAccount: (id: string) => void
  onSecurity: (id: string) => void
  onHoldings: () => void
}) {
  const goals = useQuery({ queryKey: ['goals'], queryFn: getGoals })
  const goal = goals.data?.find((g) => g.goal.status === 'ACTIVE')
  const params = new URLSearchParams({
    as_of: asOf,
    currency,
    ...(accountId ? { account_ids: accountId } : {}),
  }).toString()
  const query = useQuery({
    queryKey: ['investments', 'analytics', 'allocation', params],
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
  const rows = query.data.rows
  if (!rows) return <p role="status">{t('parity:history_unavailable')}</p>
  const accounts = overviewGroups(rows, 'account_id')
  const holdings = topHoldings(rows)
  return (
    <>
      <p className="metadata">
        {asOf} &middot; {currency}
      </p>
      {query.data.quality !== 'COMPLETE' && (
        <p role="status" className="metadata">
          {t('parity:known_holdings_only')}
        </p>
      )}
      <div className="portfolio-overview-rows">
        <section>
          <SectionHeader title={t('parity:accounts')} />
          {!accounts.length && <EmptyState title={t('parity:no_accounts')} />}
          {accounts.map((a) => (
            <button
              className="portfolio-account-row"
              key={a.id}
              onClick={() => onAccount(a.id)}
            >
              <strong>{a.name}</strong>
              <strong>
                {a.value === null ? (
                  t('common:unavailable')
                ) : (
                  <Money value={a.value} currency={currency} minorUnits />
                )}
              </strong>
            </button>
          ))}
        </section>
        <section>
          <SectionHeader title={t('parity:top_holdings')}>
            <button onClick={onHoldings}>{t('parity:view_all')}</button>
          </SectionHeader>
          {!holdings.length && (
            <EmptyState title={t('parity:no_valued_holdings')} />
          )}
          <div className="portfolio-holding-group">
            {holdings.map((h) => (
              <button
                className="portfolio-holding-row"
                key={h.id}
                onClick={() => onSecurity(h.id)}
              >
                <span>
                  <strong>
                    {assets.find((a) => a.id === h.id)?.name ?? h.name}
                  </strong>
                  <small>{assets.find((a) => a.id === h.id)?.symbol}</small>
                </span>
                <Money value={h.value} currency={currency} minorUnits />
              </button>
            ))}
          </div>
        </section>
      </div>
      {goal && (
        <section className="portfolio-goal-preview">
          <SectionHeader
            title={t('parity:current_goal')}
            detail={`${localDate()} - ${t('parity:goal_separate_scope')}`}
          />
          <button
            onClick={() =>
              navigateTo('Goals', undefined, { goal: goal.goal.id })
            }
          >
            <span>{goal.goal.name}</span>
            {goal.saved === null ? (
              <span>{t('common:unavailable')}</span>
            ) : (
              <Money
                value={goal.saved}
                currency={goal.goal.currency}
                minorUnits
              />
            )}
            <span>/</span>
            <Money
              value={goal.goal.target}
              currency={goal.goal.currency}
              minorUnits
            />
          </button>
        </section>
      )}
    </>
  )
}
